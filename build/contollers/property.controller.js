"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPropertyMediaStats = exports.updateMedia = exports.getMediaById = exports.bulkDeleteMedia = exports.getPropertyMedia = exports.setPrimaryMedia = exports.deleteMedia = exports.uploadPropertyMedia = exports.getPublicPropertyById = exports.getAvailableProperties = exports.getMyProperties = exports.reviewProperty = exports.deleteProperty = exports.updateProperty = exports.getPropertyById = exports.getAllProperties = exports.createProperty = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const property_service_1 = require("../services/property.service");
const media_service_1 = require("../services/media.service");
const attachBaseUrl_utils_1 = require("../utils/attachBaseUrl.utils");
const client_1 = require("@prisma/client");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const NotFoundError_1 = require("../errors/NotFoundError");
const BadRequestError_1 = require("../errors/BadRequestError");
const serialize_utils_1 = require("../utils/serialize.utils");
const activity_controller_1 = require("./activity.controller");
const viewTracking_service_1 = require("../services/viewTracking.service");
const createProperty = async (req, res, next) => {
    try {
        const user = req.user;
        const files = req.files;
        if (user.role === client_1.Role.VENDOR) {
            const vendor = await prisma_1.default.user.findUnique({
                where: { id: user.id },
                select: { ninVerificationStatus: true }
            });
            if (!vendor || vendor.ninVerificationStatus !== client_1.VerificationStatus.VERIFIED) {
                throw new ForbiddenError_1.ForbiddenError("Your NIN must be verified by admin before you can list properties");
            }
        }
        const property = await property_service_1.PropertyService.createProperty(user.id, user.role, req.body, files);
        await (0, activity_controller_1.logActivity)(user.id, 'CREATE_PROPERTY', 'PROPERTY', property.id, { propertyName: property.name, listingStatus: client_1.PropertyListingStatus.PENDING }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property created successfully and is pending admin approval.", property, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createProperty = createProperty;
const getAllProperties = async (req, res, next) => {
    try {
        const user = req.user;
        const result = await property_service_1.PropertyService.getAllProperties(user.id, user.role, req.query);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Properties retrieved successfully", {
            properties: (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(result.properties), req),
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAllProperties = getAllProperties;
const getPropertyById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const property = await property_service_1.PropertyService.getPropertyById(user.id, user.role, id);
        setImmediate(() => {
            viewTracking_service_1.ViewTrackingService.trackView(id, user.id).catch(error => {
                console.error('View tracking error:', error);
            });
        });
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_PROPERTY', 'PROPERTY', property.id, { propertyName: property.name }, req);
        const propertyWithBaseUrls = (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(property), req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property retrieved successfully", propertyWithBaseUrls);
    }
    catch (error) {
        next(error);
    }
};
exports.getPropertyById = getPropertyById;
const updateProperty = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const files = req.files;
        const updatedProperty = await property_service_1.PropertyService.updateProperty(user.id, user.role, id, req.body, files);
        await (0, activity_controller_1.logActivity)(user.id, 'UPDATE_PROPERTY', 'PROPERTY', id, { updates: Object.keys(req.body) }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property updated successfully", updatedProperty);
    }
    catch (error) {
        next(error);
    }
};
exports.updateProperty = updateProperty;
const deleteProperty = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        await property_service_1.PropertyService.deleteProperty(user.id, user.role, id);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_PROPERTY', 'PROPERTY', id, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteProperty = deleteProperty;
const reviewProperty = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        const user = req.user;
        if (user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only admins can review properties");
        }
        if (!status || (status !== 'accept' && status !== 'reject')) {
            throw new BadRequestError_1.BadRequestError("Status must be either 'accept' or 'reject'");
        }
        // If rejecting, rejection reason is required
        if (status === 'reject' && !rejectionReason) {
            throw new BadRequestError_1.BadRequestError("Rejection reason is required when rejecting a property");
        }
        const property = await prisma_1.default.property.findUnique({
            where: { id: id },
            include: {
                vendor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        if (property.listingStatus !== client_1.PropertyListingStatus.PENDING) {
            throw new ForbiddenError_1.ForbiddenError("Property is not in pending status");
        }
        const isApproved = status === 'accept';
        const updateData = {
            listingStatus: isApproved ? client_1.PropertyListingStatus.ACTIVE : client_1.PropertyListingStatus.REJECTED,
            reviewedBy: user.id,
            reviewedAt: new Date()
        };
        if (!isApproved) {
            updateData.rejectionReason = rejectionReason;
        }
        const updatedProperty = await prisma_1.default.property.update({
            where: { id: id },
            data: updateData,
            include: {
                vendor: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                },
                staff: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        employeeId: true,
                        department: true
                    }
                },
                media: true
            }
        });
        // Create notification for vendor
        const notificationType = isApproved ? 'PROPERTY_APPROVED' : 'PROPERTY_REJECTED';
        const notificationTitle = isApproved ? 'Property Approved' : 'Property Rejected';
        const notificationMessage = isApproved
            ? `Your property "${property.name}" has been approved and is now live.`
            : `Your property "${property.name}" was rejected. Reason: ${rejectionReason}`;
        await prisma_1.default.notification.create({
            data: {
                userId: property.vendorId,
                type: notificationType,
                title: notificationTitle,
                message: notificationMessage,
                data: {
                    propertyId: property.id,
                    ...(rejectionReason && { rejectionReason })
                }
            }
        });
        await (0, activity_controller_1.logActivity)(user.id, isApproved ? 'APPROVE_PROPERTY' : 'REJECT_PROPERTY', 'PROPERTY', id, {
            propertyName: property.name,
            status,
            ...(rejectionReason && { rejectionReason })
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, isApproved ? "Property approved successfully" : "Property rejected successfully", updatedProperty);
    }
    catch (error) {
        next(error);
    }
};
exports.reviewProperty = reviewProperty;
const getMyProperties = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can access this endpoint");
        }
        const { page = 1, limit = 10, status, listingStatus, listingType, search } = req.query;
        const result = await property_service_1.PropertyService.getMyProperties(user.id, user.role, {
            page: Number(page),
            limit: Number(limit),
            status: status,
            listingStatus: listingStatus,
            listingType: listingType,
            search: search
        });
        // Attach base URLs to media
        const propertiesWithUrls = (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(result.properties), req);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_MY_PROPERTIES', 'PROPERTY', 'my-properties', {
            totalProperties: result.totalProperties.find((p) => p.TotalListing !== undefined)?.TotalListing || 0,
            page: result.pagination.page
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "My Properties retrieved successfully", {
            totalProperties: result.totalProperties,
            properties: propertiesWithUrls,
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyProperties = getMyProperties;
const getAvailableProperties = async (req, res, next) => {
    try {
        const { type, listingType, city, state, bedrooms, minPrice, maxPrice, status, page = 1, limit = 12 } = req.query;
        const result = await property_service_1.PropertyService.getAvailableProperties({
            type: type,
            listingType: listingType,
            city: city,
            state: state,
            bedrooms: bedrooms,
            minPrice: minPrice,
            maxPrice: maxPrice,
            status: status,
            page: Number(page),
            limit: Number(limit)
        });
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Available properties retrieved successfully", {
            properties: (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(result.properties), req),
            pagination: result.pagination
        });
    }
    catch (error) {
        next(error);
    }
};
exports.getAvailableProperties = getAvailableProperties;
const getPublicPropertyById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const property = await property_service_1.PropertyService.getPublicPropertyById(id);
        const userId = req.user?.id;
        setImmediate(() => {
            viewTracking_service_1.ViewTrackingService.trackView(id, userId).catch(error => {
                console.error('View tracking error:', error);
            });
        });
        const propertyWithBaseUrls = (0, attachBaseUrl_utils_1.attachBaseUrlUploads)((0, serialize_utils_1.serializeDates)(property), req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property retrieved successfully", propertyWithBaseUrls);
    }
    catch (error) {
        next(error);
    }
};
exports.getPublicPropertyById = getPublicPropertyById;
const uploadPropertyMedia = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const files = req.files;
        const { result, savedMedia, mediaDataLength } = await media_service_1.MediaService.uploadPropertyMedia(user.id, user.role, id, files);
        await (0, activity_controller_1.logActivity)(user.id, 'UPLOAD_PROPERTY_MEDIA', 'PROPERTY', id, { mediaCount: mediaDataLength }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, `Successfully uploaded ${mediaDataLength} file(s)`, {
            propertyId: id,
            uploadedCount: result.count,
            uploadedFiles: savedMedia.map((m) => ({
                id: m.id,
                name: m.name,
                type: m.type,
                url: m.url,
                size: m.size,
                mimeType: m.mimeType,
                isPrimary: m.isPrimary
            }))
        });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadPropertyMedia = uploadPropertyMedia;
const deleteMedia = async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        const user = req.user;
        await media_service_1.MediaService.deleteMedia(user.id, user.role, mediaId);
        await (0, activity_controller_1.logActivity)(user.id, 'DELETE_MEDIA', 'MEDIA', mediaId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Media deleted successfully");
    }
    catch (error) {
        next(error);
    }
};
exports.deleteMedia = deleteMedia;
const setPrimaryMedia = async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        const user = req.user;
        const updatedMedia = await media_service_1.MediaService.setPrimaryMedia(user.id, user.role, mediaId);
        await (0, activity_controller_1.logActivity)(user.id, 'SET_PRIMARY_MEDIA', 'MEDIA', mediaId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Primary media set successfully", updatedMedia);
    }
    catch (error) {
        next(error);
    }
};
exports.setPrimaryMedia = setPrimaryMedia;
const getPropertyMedia = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const { type } = req.query;
        const media = await media_service_1.MediaService.getPropertyMedia(user.id, user.role, id, type);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property media retrieved successfully", media);
    }
    catch (error) {
        next(error);
    }
};
exports.getPropertyMedia = getPropertyMedia;
const bulkDeleteMedia = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { mediaIds } = req.body;
        const user = req.user;
        if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
            throw new BadRequestError_1.BadRequestError("mediaIds array is required");
        }
        const result = await media_service_1.MediaService.bulkDeleteMedia(user.id, user.role, id, mediaIds);
        await (0, activity_controller_1.logActivity)(user.id, 'BULK_DELETE_MEDIA', 'PROPERTY', id, { deletedCount: result.deletedCount }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Media deleted successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.bulkDeleteMedia = bulkDeleteMedia;
const getMediaById = async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        const user = req.user;
        const media = await media_service_1.MediaService.getMediaById(user.id, user.role, mediaId);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Media retrieved successfully", media);
    }
    catch (error) {
        next(error);
    }
};
exports.getMediaById = getMediaById;
const updateMedia = async (req, res, next) => {
    try {
        const { mediaId } = req.params;
        const { name } = req.body;
        const user = req.user;
        if (!name) {
            throw new BadRequestError_1.BadRequestError("Name is required");
        }
        const updatedMedia = await media_service_1.MediaService.updateMedia(user.id, user.role, mediaId, { name });
        await (0, activity_controller_1.logActivity)(user.id, 'UPDATE_MEDIA', 'MEDIA', mediaId, { newName: name }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Media updated successfully", updatedMedia);
    }
    catch (error) {
        next(error);
    }
};
exports.updateMedia = updateMedia;
const getPropertyMediaStats = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;
        const stats = await media_service_1.MediaService.getPropertyMediaStats(user.id, user.role, id);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property media stats retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getPropertyMediaStats = getPropertyMediaStats;
