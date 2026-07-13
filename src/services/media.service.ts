import prisma from "../prisma";
import { Role, MediaType } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import { uploadMultipleToAzure, deleteFile, STORAGE_CONTAINERS } from "../config/upload";
import { PropertyService } from "./property.service";

export class MediaService {
  
  static async deleteMedia(userId: string, role: Role, mediaId: string) {
    const media = await prisma.media.findUnique({
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
      throw new NotFoundError("Media not found");
    }

    let canDelete = false;

    if (role === Role.ADMIN) {
      canDelete = true;
    } else if (role === Role.VENDOR && media.property) {
      canDelete = media.property.vendorId === userId;
    } else if (role === Role.STAFF && media.property) {
      canDelete = media.property.staffId === userId;
    } else if (role === Role.USER) {
      throw new ForbiddenError("Users do not have permission to delete media");
    }

    if (!canDelete) {
      throw new ForbiddenError("You don't have permission to delete this media");
    }
    await deleteFile(media.key, media.container ?? undefined);
    await prisma.media.delete({ where: { id: mediaId } });
    return { success: true };
  }


  static async setPrimaryMedia(userId: string, role: Role, mediaId: string) {
    const media = await prisma.media.findUnique({
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
      throw new NotFoundError("Media not found");
    }
    if (!media.propertyId) {
      throw new BadRequestError("This media is not associated with a property");
    }

    let canUpdate = false;

    if (role === Role.ADMIN) {
      canUpdate = true;
    } else if (role === Role.VENDOR && media.property) {
      canUpdate = media.property.vendorId === userId;
    } else if (role === Role.STAFF && media.property) {
      canUpdate = media.property.staffId === userId;
    } else if (role === Role.USER) {
      throw new ForbiddenError("Users do not have permission to set primary media");
    }

    if (!canUpdate) {
      throw new ForbiddenError("You don't have permission to set primary media");
    }

    await prisma.media.updateMany({
      where: { 
        propertyId: media.propertyId,
        id: { not: mediaId }
      },
      data: { isPrimary: false }
    });

    const updatedMedia = await prisma.media.update({
      where: { id: mediaId },
      data: { isPrimary: true }
    });

    return updatedMedia;
  }

  static async uploadPropertyMedia(
    userId: string, 
    role: Role, 
    propertyId: string, 
    files: any
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { 
        vendor: true, 
        staff: true 
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    let canUpload = false;

    if (role === Role.ADMIN) {
      canUpload = true;
    } else if (role === Role.VENDOR) {
      canUpload = property.vendorId === userId;
    } else if (role === Role.STAFF) {
      canUpload = property.staffId === userId;
    } else if (role === Role.USER) {
      throw new ForbiddenError("Users do not have permission to upload media to properties");
    }

    if (!canUpload) {
      throw new ForbiddenError("You don't have permission to upload media to this property");
    }

    const mediaData: any[] = [];
    if (files.video && files.video.length > 0) {
      const videoUrls = process.env.STORAGE_DRIVER === 'azure'
        ? await uploadMultipleToAzure(files.video, STORAGE_CONTAINERS.PROPERTY_VIDEOS)
        : files.video.map((file: any) => file.location || `/uploads/${file.filename}`);

      videoUrls.forEach((url: string, index: number) => {
        mediaData.push({
          name: files.video[index].originalname,
          type: MediaType.VIDEO,
          url,
          key: url.split('/').pop() || '',
          size: files.video[index].size,
          container: STORAGE_CONTAINERS.PROPERTY_VIDEOS,
          mimeType: files.video[index].mimetype,
          propertyId,
          isPrimary: false
        });
      });
    }

    if (files.doc && files.doc.length > 0) {
      const docUrls = process.env.STORAGE_DRIVER === 'azure'
        ? await uploadMultipleToAzure(files.doc, STORAGE_CONTAINERS.PROPERTY_DOCUMENTS)
        : files.doc.map((file: any) => file.location || `/uploads/${file.filename}`);

      docUrls.forEach((url: string, index: number) => {
        mediaData.push({
          name: files.doc[index].originalname,
          type: MediaType.DOCUMENT,
          url,
          key: url.split('/').pop() || '',
          size: files.doc[index].size,
          container: STORAGE_CONTAINERS.PROPERTY_DOCUMENTS,
          mimeType: files.doc[index].mimetype,
          propertyId,
          isPrimary: false
        });
      });
    }

    if (files.photos && files.photos.length > 0) {
      const photoUrls = process.env.STORAGE_DRIVER === 'azure'
        ? await uploadMultipleToAzure(files.photos, STORAGE_CONTAINERS.PROPERTY_PHOTOS)
        : files.photos.map((file: any) => file.location || `/uploads/${file.filename}`);

      photoUrls.forEach((url: string, index: number) => {
        const isPrimary = index === 0 && !mediaData.some(m => m.isPrimary === true);
        mediaData.push({
          name: files.photos[index].originalname,
          type: MediaType.IMAGE,
          url,
          key: url.split('/').pop() || '',
          size: files.photos[index].size,
          container: STORAGE_CONTAINERS.PROPERTY_PHOTOS,
          mimeType: files.photos[index].mimetype,
          propertyId,
          isPrimary
        });
      });
    }

    if (mediaData.length === 0) {
      throw new BadRequestError(
        "No files provided. Please upload 'photos', 'video', or 'doc' files."
      );
    }

    const hasPrimary = mediaData.some(m => m.isPrimary === true);
    if (!hasPrimary && mediaData.some(m => m.type === MediaType.IMAGE)) {
      const firstImageIndex = mediaData.findIndex(m => m.type === MediaType.IMAGE);
      if (firstImageIndex !== -1) {
        mediaData[firstImageIndex].isPrimary = true;
      }
    }

    const result = await prisma.media.createMany({ data: mediaData });

    const savedMedia = await prisma.media.findMany({
      where: {
        propertyId: property.id,
        id: {
          in: mediaData.map((_, index) => {
            return undefined as any;
          })
        }
      },
      orderBy: { createdAt: 'desc' },
      take: mediaData.length
    });

    const allMedia = await prisma.media.findMany({
      where: {
        propertyId: property.id,
        type: { in: [MediaType.VIDEO, MediaType.DOCUMENT, MediaType.IMAGE] }
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


  static async getPropertyMedia(
    userId: string, 
    role: Role, 
    propertyId: string, 
    type?: string
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        vendor: true,
        staff: true
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    let canView = false;

    if (role === Role.ADMIN) {
      canView = true;
    } else if (role === Role.VENDOR) {
      canView = property.vendorId === userId;
    } else if (role === Role.STAFF) {
      canView = property.staffId === userId;
    } else if (role === Role.USER) {
      canView = property.listingStatus === 'ACTIVE';
    }

    if (!canView) {
      throw new ForbiddenError("You don't have access to this property's media");
    }

    const where: any = { propertyId };
    if (type === 'video') {
      where.type = MediaType.VIDEO;
    } else if (type === 'doc') {
      where.type = MediaType.DOCUMENT;
    } else if (type === 'image') {
      where.type = MediaType.IMAGE;
    }

    const media = await prisma.media.findMany({
      where,
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const images = media.filter((m: any) => m.type === MediaType.IMAGE);
    const videos = media.filter((m: any) => m.type === MediaType.VIDEO);
    const documents = media.filter((m: any) => m.type === MediaType.DOCUMENT);

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


static async getMediaById(userId: string, role: Role, mediaId: string) {
    const media = await prisma.media.findUnique({
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
      throw new NotFoundError("Media not found");
    }

    // If media is not associated with a property, only admin can view
    if (!media.property) {
      if (role !== Role.ADMIN) {
        throw new ForbiddenError("You don't have permission to view this media");
      }
      return media;
    }

    let canView = false;

    if (role === Role.ADMIN) {
      canView = true;
    } else if (role === Role.VENDOR) {
      canView = media.property.vendorId === userId;
    } else if (role === Role.STAFF) {
      canView = media.property.staffId === userId;
    } else if (role === Role.USER) {
      canView = media.property.listingStatus === 'ACTIVE';
    }

    if (!canView) {
      throw new ForbiddenError("You don't have permission to view this media");
    }

    return media;
  }

  static async bulkDeleteMedia(
    userId: string, 
    role: Role, 
    propertyId: string, 
    mediaIds: string[]
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        vendor: true,
        staff: true
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    let canDelete = false;

    if (role === Role.ADMIN) {
      canDelete = true;
    } else if (role === Role.VENDOR) {
      canDelete = property.vendorId === userId;
    } else if (role === Role.STAFF) {
      canDelete = property.staffId === userId;
    } else if (role === Role.USER) {
      throw new ForbiddenError("Users do not have permission to delete media");
    }

    if (!canDelete) {
      throw new ForbiddenError("You don't have permission to delete media from this property");
    }

    const mediaToDelete = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        propertyId: propertyId
      }
    });

    if (mediaToDelete.length !== mediaIds.length) {
      throw new BadRequestError("Some media files do not belong to this property");
    }

    for (const media of mediaToDelete) {
      await deleteFile(media.key, media.container ?? undefined);
    }

    const result = await prisma.media.deleteMany({
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

  static async updateMedia(
    userId: string, 
    role: Role, 
    mediaId: string, 
    data: { name?: string }
  ) {
    const media = await prisma.media.findUnique({
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
      throw new NotFoundError("Media not found");
    }

    let canUpdate = false;

    if (role === Role.ADMIN) {
      canUpdate = true;
    } else if (role === Role.VENDOR && media.property) {
      canUpdate = media.property.vendorId === userId;
    } else if (role === Role.STAFF && media.property) {
      canUpdate = media.property.staffId === userId;
    } else if (role === Role.USER) {
      throw new ForbiddenError("Users do not have permission to update media");
    }

    if (!canUpdate) {
      throw new ForbiddenError("You don't have permission to update this media");
    }

    const updatedMedia = await prisma.media.update({
      where: { id: mediaId },
      data: {
        name: data.name
      }
    });

    return updatedMedia;
  }

  static async getPropertyMediaStats(
    userId: string, 
    role: Role, 
    propertyId: string
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        vendor: true,
        staff: true
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    let canView = false;

    if (role === Role.ADMIN) {
      canView = true;
    } else if (role === Role.VENDOR) {
      canView = property.vendorId === userId;
    } else if (role === Role.STAFF) {
      canView = property.staffId === userId;
    } else if (role === Role.USER) {
      canView = property.listingStatus === 'ACTIVE';
    }

    if (!canView) {
      throw new ForbiddenError("You don't have access to this property's media stats");
    }

    const [total, byType, hasPrimary] = await Promise.all([
      prisma.media.count({ where: { propertyId } }),
      prisma.media.groupBy({
        by: ['type'],
        where: { propertyId },
        _count: true
      }),
      prisma.media.count({
        where: { 
          propertyId, 
          isPrimary: true 
        }
      })
    ]);

    const typeStats = byType.reduce((acc: any, item: any) => {
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