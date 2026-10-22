"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreditPurchaseService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const logger_1 = __importDefault(require("../config/logger"));
const paystack_service_1 = require("./paystack.service");
const creditPoint_service_1 = require("./creditPoint.service");
const mail_services_1 = require("./mail.services");
const mailTemplate_1 = require("../utils/mailTemplate");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class CreditPurchaseService {
    static generatePurchaseNumber() {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `PUR-${year}-${random}`;
    }
    static async initializePurchase(userId, points) {
        const user = await prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, fullName: true, role: true }
        });
        if (!user) {
            throw new NotFoundError_1.NotFoundError("User not found");
        }
        if (user.role !== client_1.Role.VENDOR) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors can purchase credit points");
        }
        const calculation = await creditPoint_service_1.CreditPointService.calculatePurchaseAmount(points);
        const reference = `CRT-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const paystackResponse = await paystack_service_1.PaystackService.initializeTransaction({
            email: user.email,
            amount: calculation.totalAmount,
            reference,
            callback_url: `${process.env.FRONTEND_URL}/vendor/credit-points/callback`,
            metadata: {
                userId: user.id,
                points: calculation.points,
                type: 'credit_point_purchase',
                amount: calculation.totalAmount
            }
        });
        const purchase = await prisma_1.default.creditPurchase.create({
            data: {
                purchaseNumber: this.generatePurchaseNumber(),
                userId: user.id,
                points: calculation.points,
                amountPaid: calculation.totalAmount,
                currency: calculation.currency,
                paystackReference: reference,
                paystackAccessCode: paystackResponse.access_code,
                paystackAuthorizationUrl: paystackResponse.authorization_url,
                paymentStatus: client_1.PaymentStatus.PENDING,
                metadata: {
                    paystackReference: reference,
                    initializedAt: new Date().toISOString()
                }
            }
        });
        logger_1.default.info(`Credit purchase initialized for user ${userId}: ${points} points`);
        return {
            purchaseId: purchase.id,
            purchaseNumber: purchase.purchaseNumber,
            reference,
            authorizationUrl: paystackResponse.authorization_url,
            accessCode: paystackResponse.access_code,
            points: calculation.points,
            amount: calculation.totalAmount,
            currency: calculation.currency,
            pricePerPoint: calculation.pricePerPoint
        };
    }
    static async verifyPurchase(reference) {
        const purchase = await prisma_1.default.creditPurchase.findUnique({
            where: { paystackReference: reference },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            }
        });
        if (!purchase) {
            throw new NotFoundError_1.NotFoundError("Purchase not found");
        }
        if (purchase.paymentStatus === client_1.PaymentStatus.SUCCESS) {
            return {
                success: true,
                message: "Payment already verified",
                purchase,
                alreadyVerified: true
            };
        }
        const paystackData = await paystack_service_1.PaystackService.verifyTransaction(reference);
        if (paystackData.status !== 'success') {
            await prisma_1.default.creditPurchase.update({
                where: { id: purchase.id },
                data: {
                    paymentStatus: client_1.PaymentStatus.FAILED,
                    metadata: {
                        ...purchase.metadata,
                        paystackResponse: paystackData,
                        failedAt: new Date().toISOString()
                    }
                }
            });
            throw new BadRequestError_1.BadRequestError(`Payment failed: ${paystackData.gateway_response || 'Unknown error'}`);
        }
        const expectedAmount = Number(purchase.amountPaid) * 100;
        if (paystackData.amount < expectedAmount) {
            throw new BadRequestError_1.BadRequestError("Payment amount does not match");
        }
        const result = await prisma_1.default.$transaction(async (tx) => {
            const updatedPurchase = await tx.creditPurchase.update({
                where: { id: purchase.id },
                data: {
                    paymentStatus: client_1.PaymentStatus.SUCCESS,
                    paidAt: new Date(),
                    metadata: {
                        ...purchase.metadata,
                        paystackResponse: paystackData,
                        verifiedAt: new Date().toISOString()
                    }
                }
            });
            const user = await tx.user.findUnique({
                where: { id: purchase.userId },
                select: { creditPoints: true }
            });
            if (!user) {
                throw new NotFoundError_1.NotFoundError("User not found");
            }
            const balanceBefore = user.creditPoints;
            const balanceAfter = balanceBefore + purchase.points;
            await tx.user.update({
                where: { id: purchase.userId },
                data: {
                    creditPoints: balanceAfter,
                    creditPointsPurchased: { increment: purchase.points }
                }
            });
            const creditTransaction = await tx.creditTransaction.create({
                data: {
                    transactionNumber: `CRT-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                    userId: purchase.userId,
                    type: client_1.CreditTransactionType.PURCHASE,
                    status: client_1.CreditTransactionStatus.COMPLETED,
                    points: purchase.points,
                    balanceBefore,
                    balanceAfter,
                    amountPaid: purchase.amountPaid,
                    currency: purchase.currency,
                    paymentReference: reference,
                    paymentStatus: client_1.PaymentStatus.SUCCESS,
                    paymentMethod: 'paystack',
                    description: `Purchased ${purchase.points} credit points for ₦${purchase.amountPaid.toLocaleString()}`,
                    metadata: {
                        paystackReference: reference,
                        purchaseId: purchase.id
                    }
                }
            });
            await tx.creditPurchase.update({
                where: { id: purchase.id },
                data: { creditTransactionId: creditTransaction.id }
            });
            return {
                purchase: updatedPurchase,
                creditTransaction,
                user: {
                    id: purchase.userId,
                    fullName: purchase.user.fullName,
                    email: purchase.user.email,
                    newBalance: balanceAfter
                }
            };
        });
        await this.sendPurchaseConfirmationEmail(result);
        logger_1.default.info(`Credit purchase verified and points added: ${purchase.points} points to user ${purchase.userId}`);
        return {
            success: true,
            message: "Payment verified and credit points added successfully",
            data: result
        };
    }
    static async sendPurchaseConfirmationEmail(data) {
        try {
            const emailHtml = await (0, mailTemplate_1.render)('credit-purchase-confirmation', {
                userName: data.user.fullName,
                points: data.purchase.points,
                amount: data.purchase.amountPaid.toLocaleString(),
                currency: data.purchase.currency,
                newBalance: data.user.newBalance,
                reference: data.purchase.paystackReference,
                purchaseDate: new Date().toLocaleString(),
                currentYear: new Date().getFullYear(),
                dashboardUrl: `${process.env.FRONTEND_URL}/vendor/credit-points`
            });
            const mailOptions = {
                to: data.user.email,
                from: `"Property Ark" ${process.env.SENDER_EMAIL}`,
                subject: `Credit Points Purchase Successful - ${data.purchase.purchaseNumber}`,
                text: `You have successfully purchased ${data.purchase.points} credit points.`,
                html: emailHtml
            };
            await (0, mail_services_1.sendGraphMail)(mailOptions);
            logger_1.default.info(`Purchase confirmation email sent to ${data.user.email}`);
        }
        catch (error) {
            logger_1.default.error('Failed to send purchase confirmation email:', error);
        }
    }
    static async handleWebhook(event) {
        const { event: eventType, data } = event;
        logger_1.default.info(`Paystack webhook received: ${eventType}`);
        switch (eventType) {
            case 'charge.success':
                if (data.reference) {
                    try {
                        await this.verifyPurchase(data.reference);
                        logger_1.default.info(`Webhook processed successfully for reference: ${data.reference}`);
                    }
                    catch (error) {
                        logger_1.default.error(`Webhook processing failed for reference ${data.reference}:`, error);
                    }
                }
                break;
            case 'charge.failed':
                if (data.reference) {
                    await prisma_1.default.creditPurchase.updateMany({
                        where: { paystackReference: data.reference },
                        data: {
                            paymentStatus: client_1.PaymentStatus.FAILED,
                            metadata: {
                                webhookData: data,
                                failedAt: new Date().toISOString()
                            }
                        }
                    });
                }
                break;
            default:
                logger_1.default.info(`Unhandled webhook event: ${eventType}`);
        }
        return { received: true };
    }
}
exports.CreditPurchaseService = CreditPurchaseService;
