import prisma from "../prisma";
import { CreditTransactionType, CreditTransactionStatus, PaymentStatus, Role } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { NotFoundError } from "../errors/NotFoundError";
import { ForbiddenError } from "../errors/ForbiddenError";
import Logger from "../config/logger";
import { PaystackService } from "./paystack.service";
import { CreditPointService } from "./creditPoint.service";
import { sendGraphMail } from "./mail.services";
import { render } from "../utils/mailTemplate";
import { MailInterface } from "../interfaces/mail.interfaces";
import dontev from "dotenv";
dontev.config();

export class CreditPurchaseService {

  private static generatePurchaseNumber(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PUR-${year}-${random}`;
  }


  static async initializePurchase(
    userId: string,
    points: number
  ): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true }
    });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.role !== Role.VENDOR) {
      throw new ForbiddenError("Only vendors can purchase credit points");
    }
    const calculation = await CreditPointService.calculatePurchaseAmount(points);

    const reference = `CRT-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const paystackResponse = await PaystackService.initializeTransaction({
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

    const purchase = await prisma.creditPurchase.create({
      data: {
        purchaseNumber: this.generatePurchaseNumber(),
        userId: user.id,
        points: calculation.points,
        amountPaid: calculation.totalAmount,
        currency: calculation.currency,
        paystackReference: reference,
        paystackAccessCode: paystackResponse.access_code,
        paystackAuthorizationUrl: paystackResponse.authorization_url,
        paymentStatus: PaymentStatus.PENDING,
        metadata: {
          paystackReference: reference,
          initializedAt: new Date().toISOString()
        }
      }
    });

    Logger.info(`Credit purchase initialized for user ${userId}: ${points} points`);

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


  static async verifyPurchase(reference: string): Promise<any> {
    const purchase = await prisma.creditPurchase.findUnique({
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
      throw new NotFoundError("Purchase not found");
    }

    if (purchase.paymentStatus === PaymentStatus.SUCCESS) {
      return {
        success: true,
        message: "Payment already verified",
        purchase,
        alreadyVerified: true
      };
    }

    const paystackData = await PaystackService.verifyTransaction(reference);

    if (paystackData.status !== 'success') {
      await prisma.creditPurchase.update({
        where: { id: purchase.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          metadata: {
            ...(purchase.metadata as any),
            paystackResponse: paystackData,
            failedAt: new Date().toISOString()
          }
        }
      });

      throw new BadRequestError(`Payment failed: ${paystackData.gateway_response || 'Unknown error'}`);
    }

    const expectedAmount = Number(purchase.amountPaid) * 100; 
    if (paystackData.amount < expectedAmount) {
      throw new BadRequestError("Payment amount does not match");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPurchase = await tx.creditPurchase.update({
        where: { id: purchase.id },
        data: {
          paymentStatus: PaymentStatus.SUCCESS,
          paidAt: new Date(),
          metadata: {
            ...(purchase.metadata as any),
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
        throw new NotFoundError("User not found");
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
          type: CreditTransactionType.PURCHASE,
          status: CreditTransactionStatus.COMPLETED,
          points: purchase.points,
          balanceBefore,
          balanceAfter,
          amountPaid: purchase.amountPaid,
          currency: purchase.currency,
          paymentReference: reference,
          paymentStatus: PaymentStatus.SUCCESS,
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

    Logger.info(`Credit purchase verified and points added: ${purchase.points} points to user ${purchase.userId}`);

    return {
      success: true,
      message: "Payment verified and credit points added successfully",
      data: result
    };
  }

  private static async sendPurchaseConfirmationEmail(data: any): Promise<void> {
    try {
      const emailHtml = await render('credit-purchase-confirmation', {
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

      const mailOptions: MailInterface = {
        to: data.user.email,
        from: `"Property Management" ${process.env.SENDER_EMAIL}`,
        subject: `Credit Points Purchase Successful - ${data.purchase.purchaseNumber}`,
        text: `You have successfully purchased ${data.purchase.points} credit points.`,
        html: emailHtml
      };

      await sendGraphMail(mailOptions);
      Logger.info(`Purchase confirmation email sent to ${data.user.email}`);
    } catch (error) {
      Logger.error('Failed to send purchase confirmation email:', error);
    }
  }

  static async handleWebhook(event: any): Promise<any> {
    const { event: eventType, data } = event;

    Logger.info(`Paystack webhook received: ${eventType}`);

    switch (eventType) {
      case 'charge.success':
        if (data.reference) {
          try {
            await this.verifyPurchase(data.reference);
            Logger.info(`Webhook processed successfully for reference: ${data.reference}`);
          } catch (error: any) {
            Logger.error(`Webhook processing failed for reference ${data.reference}:`, error);
          }
        }
        break;

      case 'charge.failed':
        if (data.reference) {
          await prisma.creditPurchase.updateMany({
            where: { paystackReference: data.reference },
            data: {
              paymentStatus: PaymentStatus.FAILED,
              metadata: {
                webhookData: data,
                failedAt: new Date().toISOString()
              }
            }
          });
        }
        break;

      default:
        Logger.info(`Unhandled webhook event: ${eventType}`);
    }

    return { received: true };
  }
}