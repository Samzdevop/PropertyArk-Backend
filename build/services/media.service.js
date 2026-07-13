"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const NotFoundError_1 = require("../errors/NotFoundError");
const upload_1 = require("../config/upload");
class MediaService {
    static async deleteMedia(userId, role, mediaId) {
        const media = await prisma_1.default.media.findUnique({
            where: { id: mediaId },
            include: {
                property: {
                    include: {
                        vendor: true,
                        staff: true
                    }
                }
            }
        });
        if (!media) {
            throw new NotFoundError_1.NotFoundError("Media not found");
        }
        let canDelete = false;
        if (role === client_1.Role.ADMIN) {
            canDelete = true;
        }
        else if (role === client_1.Role.VENDOR && media.property) {
            canDelete = media.property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF && media.property) {
            canDelete = media.property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            throw new ForbiddenError_1.ForbiddenError("Users do not have permission to delete media");
        }
        if (!canDelete) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to delete this media");
        }
        await (0, upload_1.deleteFile)(media.key, media.container ?? undefined);
        await prisma_1.default.media.delete({ where: { id: mediaId } });
        return { success: true };
    }
    static async setPrimaryMedia(userId, role, mediaId) {
        const media = await prisma_1.default.media.findUnique({
            where: { id: mediaId },
            include: {
                property: {
                    include: {
                        vendor: true,
                        staff: true
                    }
                }
            }
        });
        if (!media) {
            throw new NotFoundError_1.NotFoundError("Media not found");
        }
        if (!media.propertyId) {
            throw new BadRequestError_1.BadRequestError("This media is not associated with a property");
        }
        let canUpdate = false;
        if (role === client_1.Role.ADMIN) {
            canUpdate = true;
        }
        else if (role === client_1.Role.VENDOR && media.property) {
            canUpdate = media.property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF && media.property) {
            canUpdate = media.property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            throw new ForbiddenError_1.ForbiddenError("Users do not have permission to set primary media");
        }
        if (!canUpdate) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to set primary media");
        }
        await prisma_1.default.media.updateMany({
            where: {
                propertyId: media.propertyId,
                id: { not: mediaId }
            },
            data: { isPrimary: false }
        });
        const updatedMedia = await prisma_1.default.media.update({
            where: { id: mediaId },
            data: { isPrimary: true }
        });
        return updatedMedia;
    }
    static async uploadPropertyMedia(userId, role, propertyId, files) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            include: {
                vendor: true,
                staff: true
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        let canUpload = false;
        if (role === client_1.Role.ADMIN) {
            canUpload = true;
        }
        else if (role === client_1.Role.VENDOR) {
            canUpload = property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF) {
            canUpload = property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            throw new ForbiddenError_1.ForbiddenError("Users do not have permission to upload media to properties");
        }
        if (!canUpload) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to upload media to this property");
        }
        const mediaData = [];
        if (files.video && files.video.length > 0) {
            const videoUrls = process.env.STORAGE_DRIVER === 'azure'
                ? await (0, upload_1.uploadMultipleToAzure)(files.video, upload_1.STORAGE_CONTAINERS.PROPERTY_VIDEOS)
                : files.video.map((file) => file.location || `/uploads/${file.filename}`);
            videoUrls.forEach((url, index) => {
                mediaData.push({
                    name: files.video[index].originalname,
                    type: client_1.MediaType.VIDEO,
                    url,
                    key: url.split('/').pop() || '',
                    size: files.video[index].size,
                    container: upload_1.STORAGE_CONTAINERS.PROPERTY_VIDEOS,
                    mimeType: files.video[index].mimetype,
                    propertyId,
                    isPrimary: false
                });
            });
        }
        if (files.doc && files.doc.length > 0) {
            const docUrls = process.env.STORAGE_DRIVER === 'azure'
                ? await (0, upload_1.uploadMultipleToAzure)(files.doc, upload_1.STORAGE_CONTAINERS.PROPERTY_DOCUMENTS)
                : files.doc.map((file) => file.location || `/uploads/${file.filename}`);
            docUrls.forEach((url, index) => {
                mediaData.push({
                    name: files.doc[index].originalname,
                    type: client_1.MediaType.DOCUMENT,
                    url,
                    key: url.split('/').pop() || '',
                    size: files.doc[index].size,
                    container: upload_1.STORAGE_CONTAINERS.PROPERTY_DOCUMENTS,
                    mimeType: files.doc[index].mimetype,
                    propertyId,
                    isPrimary: false
                });
            });
        }
        if (files.photos && files.photos.length > 0) {
            const photoUrls = process.env.STORAGE_DRIVER === 'azure'
                ? await (0, upload_1.uploadMultipleToAzure)(files.photos, upload_1.STORAGE_CONTAINERS.PROPERTY_PHOTOS)
                : files.photos.map((file) => file.location || `/uploads/${file.filename}`);
            photoUrls.forEach((url, index) => {
                const isPrimary = index === 0 && !mediaData.some(m => m.isPrimary === true);
                mediaData.push({
                    name: files.photos[index].originalname,
                    type: client_1.MediaType.IMAGE,
                    url,
                    key: url.split('/').pop() || '',
                    size: files.photos[index].size,
                    container: upload_1.STORAGE_CONTAINERS.PROPERTY_PHOTOS,
                    mimeType: files.photos[index].mimetype,
                    propertyId,
                    isPrimary
                });
            });
        }
        if (mediaData.length === 0) {
            throw new BadRequestError_1.BadRequestError("No files provided. Please upload 'photos', 'video', or 'doc' files.");
        }
        const hasPrimary = mediaData.some(m => m.isPrimary === true);
        if (!hasPrimary && mediaData.some(m => m.type === client_1.MediaType.IMAGE)) {
            const firstImageIndex = mediaData.findIndex(m => m.type === client_1.MediaType.IMAGE);
            if (firstImageIndex !== -1) {
                mediaData[firstImageIndex].isPrimary = true;
            }
        }
        const result = await prisma_1.default.media.createMany({ data: mediaData });
        const savedMedia = await prisma_1.default.media.findMany({
            where: {
                propertyId: property.id,
                id: {
                    in: mediaData.map((_, index) => {
                        return undefined;
                    })
                }
            },
            orderBy: { createdAt: 'desc' },
            take: mediaData.length
        });
        const allMedia = await prisma_1.default.media.findMany({
            where: {
                propertyId: property.id,
                type: { in: [client_1.MediaType.VIDEO, client_1.MediaType.DOCUMENT, client_1.MediaType.IMAGE] }
            },
            orderBy: { createdAt: 'desc' },
            take: mediaData.length
        });
        return {
            result,
            savedMedia: allMedia,
            mediaDataLength: mediaData.length
        };
    }
    static async getPropertyMedia(userId, role, propertyId, type) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            include: {
                vendor: true,
                staff: true
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        let canView = false;
        if (role === client_1.Role.ADMIN) {
            canView = true;
        }
        else if (role === client_1.Role.VENDOR) {
            canView = property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF) {
            canView = property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            canView = property.listingStatus === 'ACTIVE';
        }
        if (!canView) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this property's media");
        }
        const where = { propertyId };
        if (type === 'video') {
            where.type = client_1.MediaType.VIDEO;
        }
        else if (type === 'doc') {
            where.type = client_1.MediaType.DOCUMENT;
        }
        else if (type === 'image') {
            where.type = client_1.MediaType.IMAGE;
        }
        const media = await prisma_1.default.media.findMany({
            where,
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        const images = media.filter((m) => m.type === client_1.MediaType.IMAGE);
        const videos = media.filter((m) => m.type === client_1.MediaType.VIDEO);
        const documents = media.filter((m) => m.type === client_1.MediaType.DOCUMENT);
        return {
            propertyId: property.id,
            propertyName: property.name,
            listingStatus: property.listingStatus,
            total: media.length,
            images: {
                count: images.length,
                items: images
            },
            videos: {
                count: videos.length,
                items: videos
            },
            documents: {
                count: documents.length,
                items: documents
            }
        };
    }
    static async getMediaById(userId, role, mediaId) {
        const media = await prisma_1.default.media.findUnique({
            where: { id: mediaId },
            include: {
                property: {
                    include: {
                        vendor: true,
                        staff: true
                    }
                }
            }
        });
        if (!media) {
            throw new NotFoundError_1.NotFoundError("Media not found");
        }
        // If media is not associated with a property, only admin can view
        if (!media.property) {
            if (role !== client_1.Role.ADMIN) {
                throw new ForbiddenError_1.ForbiddenError("You don't have permission to view this media");
            }
            return media;
        }
        let canView = false;
        if (role === client_1.Role.ADMIN) {
            canView = true;
        }
        else if (role === client_1.Role.VENDOR) {
            canView = media.property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF) {
            canView = media.property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            canView = media.property.listingStatus === 'ACTIVE';
        }
        if (!canView) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to view this media");
        }
        return media;
    }
    static async bulkDeleteMedia(userId, role, propertyId, mediaIds) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            include: {
                vendor: true,
                staff: true
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        let canDelete = false;
        if (role === client_1.Role.ADMIN) {
            canDelete = true;
        }
        else if (role === client_1.Role.VENDOR) {
            canDelete = property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF) {
            canDelete = property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            throw new ForbiddenError_1.ForbiddenError("Users do not have permission to delete media");
        }
        if (!canDelete) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to delete media from this property");
        }
        const mediaToDelete = await prisma_1.default.media.findMany({
            where: {
                id: { in: mediaIds },
                propertyId: propertyId
            }
        });
        if (mediaToDelete.length !== mediaIds.length) {
            throw new BadRequestError_1.BadRequestError("Some media files do not belong to this property");
        }
        for (const media of mediaToDelete) {
            await (0, upload_1.deleteFile)(media.key, media.container ?? undefined);
        }
        const result = await prisma_1.default.media.deleteMany({
            where: {
                id: { in: mediaIds },
                propertyId: propertyId
            }
        });
        return {
            success: true,
            deletedCount: result.count,
            deletedIds: mediaIds
        };
    }
    static async updateMedia(userId, role, mediaId, data) {
        const media = await prisma_1.default.media.findUnique({
            where: { id: mediaId },
            include: {
                property: {
                    include: {
                        vendor: true,
                        staff: true
                    }
                }
            }
        });
        if (!media) {
            throw new NotFoundError_1.NotFoundError("Media not found");
        }
        let canUpdate = false;
        if (role === client_1.Role.ADMIN) {
            canUpdate = true;
        }
        else if (role === client_1.Role.VENDOR && media.property) {
            canUpdate = media.property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF && media.property) {
            canUpdate = media.property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            throw new ForbiddenError_1.ForbiddenError("Users do not have permission to update media");
        }
        if (!canUpdate) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to update this media");
        }
        const updatedMedia = await prisma_1.default.media.update({
            where: { id: mediaId },
            data: {
                name: data.name
            }
        });
        return updatedMedia;
    }
    static async getPropertyMediaStats(userId, role, propertyId) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            include: {
                vendor: true,
                staff: true
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        let canView = false;
        if (role === client_1.Role.ADMIN) {
            canView = true;
        }
        else if (role === client_1.Role.VENDOR) {
            canView = property.vendorId === userId;
        }
        else if (role === client_1.Role.STAFF) {
            canView = property.staffId === userId;
        }
        else if (role === client_1.Role.USER) {
            canView = property.listingStatus === 'ACTIVE';
        }
        if (!canView) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this property's media stats");
        }
        const [total, byType, hasPrimary] = await Promise.all([
            prisma_1.default.media.count({ where: { propertyId } }),
            prisma_1.default.media.groupBy({
                by: ['type'],
                where: { propertyId },
                _count: true
            }),
            prisma_1.default.media.count({
                where: {
                    propertyId,
                    isPrimary: true
                }
            })
        ]);
        const typeStats = byType.reduce((acc, item) => {
            acc[item.type] = item._count;
            return acc;
        }, {});
        return {
            propertyId: property.id,
            propertyName: property.name,
            total,
            hasPrimary: hasPrimary > 0,
            byType: {
                IMAGE: typeStats.IMAGE || 0,
                VIDEO: typeStats.VIDEO || 0,
                DOCUMENT: typeStats.DOCUMENT || 0
            }
        };
    }
}
exports.MediaService = MediaService;
