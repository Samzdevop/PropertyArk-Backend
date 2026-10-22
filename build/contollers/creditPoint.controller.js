"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminGiftCreditPoints = exports.cleanupExpiredFeatured = exports.getFeaturedProperties = exports.unfeatureProperty = exports.featureProperty = exports.paystackWebhook = exports.verifyPurchase = exports.initializePurchase = exports.calculatePurchase = exports.getMyCreditInfo = exports.updateSettings = exports.getSettings = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const creditPoint_service_1 = require("../services/creditPoint.service");
const creditPurchase_service_1 = require("../services/creditPurchase.service");
const paystack_service_1 = require("../services/paystack.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const BadRequestError_1 = require("../errors/BadRequestError");
const client_1 = require("@prisma/client");
const getSettings = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can view credit point settings");
        }
        const settings = await creditPoint_service_1.CreditPointService.getSettings();
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Credit point settings retrieved successfully", settings);
    }
    catch (error) {
        next(error);
    }
};
exports.getSettings = getSettings;
const updateSettings = async (req, res, next) => {
    try {
        const user = req.user;
        const { newVendorBonusPoints, newVendorBonusExpiryDays, propertyCreationCost, featurePropertyCost, featurePropertyDurationDays, minimumPurchasePoints, pricePerPoint, currency } = req.body;
        const settings = await creditPoint_service_1.CreditPointService.updateSettings(user.id, {
            newVendorBonusPoints,
            newVendorBonusExpiryDays,
            propertyCreationCost,
            featurePropertyCost,
            featurePropertyDurationDays,
            minimumPurchasePoints,
            pricePerPoint,
            currency
        });
        await (0, activity_controller_1.logActivity)(user.id, 'UPDATE_CREDIT_SETTINGS', 'CREDIT_POINT', settings.id, {
            propertyCreationCost,
            featurePropertyCost,
            minimumPurchasePoints,
            pricePerPoint
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Credit point settings updated successfully", settings);
    }
    catch (error) {
        next(error);
    }
};
exports.updateSettings = updateSettings;
const getMyCreditInfo = async (req, res, next) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20 } = req.query;
        const result = await creditPoint_service_1.CreditPointService.getUserCreditInfo(user.id, Number(page), Number(limit));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Credit info retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getMyCreditInfo = getMyCreditInfo;
const calculatePurchase = async (req, res, next) => {
    try {
        const user = req.user;
        const { points } = req.query;
        if (!points) {
            throw new BadRequestError_1.BadRequestError("Points parameter is required");
        }
        const calculation = await creditPoint_service_1.CreditPointService.calculatePurchaseAmount(Number(points));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Purchase amount calculated successfully", calculation);
    }
    catch (error) {
        next(error);
    }
};
exports.calculatePurchase = calculatePurchase;
const initializePurchase = async (req, res, next) => {
    try {
        const user = req.user;
        const { points } = req.body;
        if (!points || points <= 0) {
            throw new BadRequestError_1.BadRequestError("Points must be greater than 0");
        }
        const result = await creditPurchase_service_1.CreditPurchaseService.initializePurchase(user.id, points);
        await (0, activity_controller_1.logActivity)(user.id, 'INITIALIZE_CREDIT_PURCHASE', 'CREDIT_POINT', result.purchaseId, {
            points,
            amount: result.amount,
            reference: result.reference
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Purchase initialized successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.initializePurchase = initializePurchase;
const verifyPurchase = async (req, res, next) => {
    try {
        const { reference } = req.params;
        if (!reference) {
            throw new BadRequestError_1.BadRequestError("Reference is required");
        }
        const result = await creditPurchase_service_1.CreditPurchaseService.verifyPurchase(reference);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Purchase verified successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.verifyPurchase = verifyPurchase;
const paystackWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-paystack-signature'];
        if (!signature) {
            throw new BadRequestError_1.BadRequestError("Missing signature");
        }
        const payload = JSON.stringify(req.body);
        if (!paystack_service_1.PaystackService.validateWebhookSignature(payload, signature)) {
            throw new BadRequestError_1.BadRequestError("Invalid signature");
        }
        const result = await creditPurchase_service_1.CreditPurchaseService.handleWebhook(req.body);
        res.status(200).json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.paystackWebhook = paystackWebhook;
const featureProperty = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId } = req.params;
        const property = await creditPoint_service_1.CreditPointService.featureProperty(propertyId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'FEATURE_PROPERTY', 'PROPERTY', propertyId, {
            propertyName: property.name,
            featuredUntil: property.featuredUntil
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property featured successfully", property);
    }
    catch (error) {
        next(error);
    }
};
exports.featureProperty = featureProperty;
const unfeatureProperty = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId } = req.params;
        const property = await creditPoint_service_1.CreditPointService.unfeatureProperty(propertyId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'UNFEATURE_PROPERTY', 'PROPERTY', propertyId, {
            propertyName: property.name
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property unfeatured successfully", property);
    }
    catch (error) {
        next(error);
    }
};
exports.unfeatureProperty = unfeatureProperty;
const getFeaturedProperties = async (req, res, next) => {
    try {
        const properties = await creditPoint_service_1.CreditPointService.getFeaturedProperties();
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Featured properties retrieved successfully", properties);
    }
    catch (error) {
        next(error);
    }
};
exports.getFeaturedProperties = getFeaturedProperties;
const cleanupExpiredFeatured = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can cleanup expired featured properties");
        }
        const count = await creditPoint_service_1.CreditPointService.cleanupExpiredFeatured();
        await (0, activity_controller_1.logActivity)(user.id, 'CLEANUP_EXPIRED_FEATURED', 'PROPERTY', 'cleanup', { count }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Cleaned up ${count} expired featured properties`, { count });
    }
    catch (error) {
        next(error);
    }
};
exports.cleanupExpiredFeatured = cleanupExpiredFeatured;
const adminGiftCreditPoints = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can gift credit points");
        }
        const { vendorIds, points, name, expiresAt, reason } = req.body;
        const result = await creditPoint_service_1.CreditPointService.adminGiftCreditPoints(user.id, {
            vendorIds,
            points: Number(points),
            name,
            expiresAt,
            reason
        });
        await (0, activity_controller_1.logActivity)(user.id, 'ADMIN_GIFT_CREDIT_POINTS', 'CREDIT_POINT', result.grantId, {
            grantId: result.grantId,
            name: result.name,
            points: result.points,
            vendorCount: result.vendorCount,
            targetAll: !vendorIds || vendorIds.length === 0
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Successfully gifted ${result.points} points to ${result.vendorCount} vendor(s)`, result);
    }
    catch (error) {
        next(error);
    }
};
exports.adminGiftCreditPoints = adminGiftCreditPoints;
