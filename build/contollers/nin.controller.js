"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadNIN = exports.getPendingNINVerifications = exports.verifyVendorNIN = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const NotFoundError_1 = require("../errors/NotFoundError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const client_1 = require("@prisma/client");
const activity_controller_1 = require("../contollers/activity.controller");
const upload_1 = require("../config/upload");
const verifyVendorNIN = async (req, res, next) => {
    try {
        const { vendorId } = req.params;
        const { status, rejectionReason } = req.body;
        const admin = req.user;
        const vendorIdstr = vendorId;
        if (admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can verify NIN");
        }
        const vendor = await prisma_1.default.user.findUnique({
            where: { id: vendorId, role: client_1.Role.VENDOR }
        });
        if (!vendor) {
            throw new NotFoundError_1.NotFoundError("Vendor not found");
        }
        if (status === client_1.VerificationStatus.VERIFIED) {
            await prisma_1.default.user.update({
                where: { id: vendorId },
                data: {
                    ninVerificationStatus: client_1.VerificationStatus.VERIFIED,
                    ninVerifiedAt: new Date(),
                    ninVerifiedBy: admin.id,
                    ninRejectionReason: null
                }
            });
            await prisma_1.default.notification.create({
                data: {
                    userId: vendorId,
                    type: 'NIN_VERIFIED',
                    title: 'NIN Verified',
                    message: 'Your NIN has been verified. You can now list properties.',
                    data: { verifiedBy: admin.id }
                }
            });
            await (0, activity_controller_1.logActivity)(admin.id, 'VERIFY_VENDOR_NIN', 'USER', vendorIdstr, { status: 'VERIFIED' }, req);
            (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vendor NIN verified successfully");
        }
        else if (status === client_1.VerificationStatus.REJECTED) {
            if (!rejectionReason) {
                throw new BadRequestError_1.BadRequestError("Rejection reason is required");
            }
            await prisma_1.default.user.update({
                where: { id: vendorId },
                data: {
                    ninVerificationStatus: client_1.VerificationStatus.REJECTED,
                    ninVerifiedAt: new Date(),
                    ninVerifiedBy: admin.id,
                    ninRejectionReason: rejectionReason
                }
            });
            // Create notification for vendor
            await prisma_1.default.notification.create({
                data: {
                    userId: vendorId,
                    type: 'NIN_REJECTED',
                    title: 'NIN Rejected',
                    message: `Your NIN was rejected. Reason: ${rejectionReason}`,
                    data: { rejectionReason }
                }
            });
            await (0, activity_controller_1.logActivity)(admin.id, 'REJECT_VENDOR_NIN', 'USER', vendorIdstr, { status: 'REJECTED', rejectionReason }, req);
            (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Vendor NIN rejected");
        }
        else {
            throw new BadRequestError_1.BadRequestError("Invalid status. Must be VERIFIED or REJECTED");
        }
    }
    catch (error) {
        next(error);
    }
};
exports.verifyVendorNIN = verifyVendorNIN;
const getPendingNINVerifications = async (req, res, next) => {
    try {
        const admin = req.user;
        if (admin.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view pending verifications");
        }
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {
            role: client_1.Role.VENDOR,
            ninVerificationStatus: client_1.VerificationStatus.PENDING
        };
        const [vendors, total] = await Promise.all([
            prisma_1.default.user.findMany({
                where,
                skip,
                take,
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    location: true,
                    ninPhotoUrl: true,
                    ninVerificationStatus: true,
                    createdAt: true,
                    documents: {
                        where: { type: 'NIN' },
                        select: {
                            id: true,
                            name: true,
                            url: true,
                            createdAt: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            }),
            prisma_1.default.user.count({ where })
        ]);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Pending NIN verifications retrieved", {
            vendors,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getPendingNINVerifications = getPendingNINVerifications;
const uploadNIN = async (req, res, next) => {
    try {
        const user = req.user;
        const file = req.file;
        if (user.role !== client_1.Role.VENDOR) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors can upload NIN");
        }
        if (!file) {
            throw new BadRequestError_1.BadRequestError("NIN photo file is required");
        }
        // Upload logic handled by multer, just update database
        const ninPhotoUrl = process.env.STORAGE_DRIVER === 'azure'
            ? file.url
            : `/uploads/${file.filename}`;
        const updatedUser = await prisma_1.default.user.update({
            where: { id: user.id },
            data: {
                ninPhotoUrl,
                ninVerificationStatus: client_1.VerificationStatus.PENDING,
                ninVerifiedAt: null,
                ninVerifiedBy: null,
                ninRejectionReason: null
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                ninPhotoUrl: true,
                ninVerificationStatus: true
            }
        });
        // Create NIN document record
        await prisma_1.default.document.create({
            data: {
                name: `NIN_${user.fullName.replace(/\s/g, '_')}`,
                type: 'NIN',
                url: ninPhotoUrl,
                key: ninPhotoUrl.split('/').pop() || '',
                size: file.size,
                mimeType: file.mimetype,
                container: upload_1.STORAGE_CONTAINERS.NIN_DOCUMENTS,
                vendorId: user.id,
                uploadedById: user.id
            }
        });
        await (0, activity_controller_1.logActivity)(user.id, 'UPLOAD_NIN', 'USER', user.id, { status: 'PENDING' }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "NIN uploaded successfully. Awaiting admin verification.", updatedUser);
    }
    catch (error) {
        next(error);
    }
};
exports.uploadNIN = uploadNIN;
