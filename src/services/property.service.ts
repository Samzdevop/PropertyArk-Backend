import prisma from "../prisma";
import { Role, PropertyListingStatus, ListingType, PropertyStatus, MediaType, VerificationStatus } from "@prisma/client";
import { BadRequestError } from "../errors/BadRequestError";
import { ForbiddenError } from "../errors/ForbiddenError";
import { NotFoundError } from "../errors/NotFoundError";
import { uploadMultipleToAzure, deleteFile, STORAGE_CONTAINERS } from "../config/upload";

export class PropertyService {

  static parseAmenities(amenities: any): string[] {
    if (!amenities) return [];

    if (typeof amenities === "string") {
      try {
        const parsed = JSON.parse(amenities);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return amenities.includes(",")
          ? amenities.split(",").map((i: string) => i.trim())
          : [amenities];
      }
    }

    if (Array.isArray(amenities)) {
      return amenities;
    }

    return [];
  }

  static validatePropertyPricing(data: any): void {
    const { listingType, rentAmount, salePrice, landFee, shortletAmount } = data;

    switch (listingType) {
      case ListingType.FOR_RENT:
        if (!rentAmount || parseFloat(rentAmount) <= 0) {
          throw new BadRequestError("Rent amount is required for FOR_RENT properties");
        }
        break;
      case ListingType.FOR_SALE:
        if (!salePrice || parseFloat(salePrice) <= 0) {
          throw new BadRequestError("Sale price is required for FOR_SALE properties");
        }
        break;
      case ListingType.FOR_LAND:
        if (!landFee || parseFloat(landFee) <= 0) {
          throw new BadRequestError("Land fee is required for FOR_LAND properties");
        }
        break;
      case ListingType.FOR_SHORTLET:
        if (!shortletAmount || parseFloat(shortletAmount) <= 0) {
          throw new BadRequestError("Shortlet amount is required for FOR_SHORTLET properties");
        }
        break;
      default:
        throw new BadRequestError("Invalid listing type");
    }
  }

  

  private static validateStatus(status: string): boolean {
    return Object.values(PropertyStatus).includes(status as PropertyStatus);
  }


  static async createProperty(
    userId: string,
    userRole: Role,
    data: any,
    files: any
  ) {
    const {
      name, description, type, listingType, address, city, state, country, zipCode,
      size, sizeUnit, bedrooms, bathrooms, yearBuilt, amenities,
      rentAmount, salePrice, landFee, shortletAmount, staffId, status
    } = data;

    let propertyStatus: PropertyStatus;

    if (!status) {
      throw new BadRequestError(
        `Status is required. Valid values: ${Object.values(PropertyStatus).join(', ')}`
      );
    }

    if (!this.validateStatus(status)) {
      throw new BadRequestError(
        `Invalid status "${status}". Must be one of: ${Object.values(PropertyStatus).join(', ')}`
      );
    }

    propertyStatus = status as PropertyStatus;

    this.validatePropertyPricing({ listingType, rentAmount, salePrice, landFee, shortletAmount });

    const parsedAmenities = this.parseAmenities(amenities);
    let vendorId = userId;
    let staffIdToUse = staffId || null;

    if (userRole === Role.STAFF) {
      if (!staffId) {
        throw new BadRequestError("Vendor ID is required when creating property as staff");
      }
      const vendor = await prisma.user.findUnique({
        where: { id: staffId, role: Role.VENDOR }
      });
      if (!vendor) {
        throw new NotFoundError("Vendor not found");
      }
      vendorId = staffId;
      staffIdToUse = userId;
    }

    if (userRole === Role.VENDOR) {
      const vendor = await prisma.user.findUnique({
        where: { id: userId },
        select: { ninVerificationStatus: true }
      });
      if (!vendor || vendor.ninVerificationStatus !== VerificationStatus.VERIFIED) {
        throw new ForbiddenError("Your NIN must be verified before you can list properties");
      }
      vendorId = userId;
    }

    const propertyData: any = {
      name,
      description,
      type,
      listingType,
      status: propertyStatus,
      listingStatus: PropertyListingStatus.PENDING,
      address,
      city,
      state,
      country,
      zipCode,
      size: size ? parseFloat(size) : null,
      sizeUnit: sizeUnit || 'sqft',
      bedrooms: bedrooms ? parseInt(bedrooms) : null,
      bathrooms: bathrooms ? parseFloat(bathrooms) : null,
      yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
      amenities: parsedAmenities,
      vendorId: vendorId,
      staffId: staffIdToUse
    };

    switch (listingType) {
      case ListingType.FOR_RENT:
        propertyData.rentAmount = parseFloat(rentAmount);
        break;
      case ListingType.FOR_SALE:
        propertyData.salePrice = parseFloat(salePrice);
        break;
      case ListingType.FOR_LAND:
        propertyData.landFee = parseFloat(landFee);
        break;
      case ListingType.FOR_SHORTLET:
        propertyData.shortletAmount = parseFloat(shortletAmount);
        break;
    }

    const property = await prisma.property.create({
      data: propertyData
    });

    if (files && Object.keys(files).length > 0) {
      this.uploadPropertyMediaInBackground(property.id, files);
    }

    return property;
  }

  private static async uploadPropertyMediaInBackground(propertyId: string, files: any) {
    try {
      const mediaData: any[] = [];
      const uploadConfig = [
        { field: "photos", type: "IMAGE", container: STORAGE_CONTAINERS.PROPERTY_PHOTOS },
        { field: "videos", type: "VIDEO", container: STORAGE_CONTAINERS.PROPERTY_VIDEOS },
        { field: "documents", type: "DOCUMENT", container: STORAGE_CONTAINERS.PROPERTY_DOCUMENTS }
      ];

      for (const config of uploadConfig) {
        const fileGroup = files[config.field];
        if (!fileGroup || fileGroup.length === 0) continue;

        const urls = await uploadMultipleToAzure(fileGroup, config.container);
        urls.forEach((url: string, index: number) => {
          mediaData.push({
            name: fileGroup[index].originalname,
            type: config.type as MediaType,
            url,
            key: url.split("/").pop() || "",
            size: fileGroup[index].size,
            mimeType: fileGroup[index].mimetype,
            container: config.container,
            propertyId: propertyId,
            isPrimary: index === 0 && config.field === "photos"
          });
        });
      }

      if (mediaData.length > 0) {
        await prisma.media.createMany({ data: mediaData });
      }
    } catch (error) {
      console.error("Background upload failed:", error);
    }
  }

  static async getAllProperties(
    userId: string,
    role: Role,
    queryParams: any
  ) {
    const { page = 1, limit = 12, status, listingType, city, state, listingStatus } = queryParams;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {};

    if (role === Role.VENDOR) {
      where.vendorId = userId;
    } else if (role === Role.STAFF) {
      where.OR = [
        { staffId: userId },
        { vendorId: userId }
      ];
    } else if (role === Role.ADMIN) {
    } else if (role === Role.USER) {
      where.listingStatus = PropertyListingStatus.ACTIVE;
    }

    if (status) where.status = status;
    if (listingType) where.listingType = listingType;
    if (listingStatus && (role === Role.ADMIN || role === Role.VENDOR || role === Role.STAFF)) {
      where.listingStatus = listingStatus;
    }
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          media: true,
          vendor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true
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
          _count: {
            select: {
              media: true,
              documents: true
            }
          }
        }
      }),
      prisma.property.count({ where })
    ]);

    const enrichedProperties = properties.map((property:any) => ({
      ...property,
      priceDisplay: this.getPriceDisplay(property)
    }));

    return {
      properties: enrichedProperties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    };
  }

  static getPriceDisplay(property: any): string {
    switch (property.listingType) {
      case ListingType.FOR_RENT:
        return property.rentAmount ? `$${property.rentAmount.toLocaleString()}/month` : 'Contact for price';
      case ListingType.FOR_SALE:
        return property.salePrice ? `$${property.salePrice.toLocaleString()}` : 'Contact for price';
      case ListingType.FOR_LAND:
        return property.landFee ? `$${property.landFee.toLocaleString()}` : 'Contact for price';
      case ListingType.FOR_SHORTLET:
        return property.shortletAmount ? `$${property.shortletAmount.toLocaleString()}/night` : 'Contact for price';
      default:
        return 'Contact for price';
    }
  }

  static async getPropertyById(userId: string, role: Role, propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        media: true,
        documents: true,
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatar: true
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
        }
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    // Check access based on role
    if (role === Role.USER) {
      if (property.listingStatus !== PropertyListingStatus.ACTIVE) {
        throw new ForbiddenError("This property is not available");
      }
    }

    if (role === Role.VENDOR && property.vendorId !== userId) {
      throw new ForbiddenError("You don't have access to this property");
    }

    return {
      ...property,
      priceDisplay: this.getPriceDisplay(property)
    };
  }

  static async getPublicPropertyById(propertyId: string) {
    const property = await prisma.property.findUnique({
      where: {
        id: propertyId,
        listingStatus: PropertyListingStatus.ACTIVE
      },
      include: {
        media: true,
        vendor: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        },
        documents: {
          select: {
            id: true,
            name: true,
            type: true,
            url: true,
            size: true,
            mimeType: true,
            createdAt: true
          }
        }
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found or not available");
    }

    return {
      ...property,
      priceDisplay: this.getPriceDisplay(property)
    };
  }

  static async updateProperty(
    userId: string,
    role: Role,
    propertyId: string,
    data: any,
    files: any
  ) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { vendor: true, staff: true }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    let canUpdate = false;
    if (role === Role.ADMIN) canUpdate = true;
    if (role === Role.VENDOR && property.vendorId === userId) canUpdate = true;
    if (role === Role.STAFF && property.staffId === userId) canUpdate = true;

    if (!canUpdate) {
      throw new ForbiddenError("You don't have permission to update this property");
    }

    const wasApproved = property.listingStatus === PropertyListingStatus.ACTIVE;
    const updateData: any = { ...data };

    if (data.status !== undefined) {
      if (!this.validateStatus(data.status)) {
        throw new BadRequestError(
          `Invalid status. Must be one of: AVAILABLE, OCCUPIED, UNDER_MAINTENANCE, UNDER_CONSTRUCTION, SOLD, RENTED`
        );
      }
      updateData.status = data.status as PropertyStatus;
    }

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.listingType !== undefined) updateData.listingType = data.listingType;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.zipCode !== undefined) updateData.zipCode = data.zipCode;
    if (data.rentAmount !== undefined) updateData.rentAmount = data.rentAmount ? parseFloat(data.rentAmount) : null;
    if (data.salePrice !== undefined) updateData.salePrice = data.salePrice ? parseFloat(data.salePrice) : null;
    if (data.landFee !== undefined) updateData.landFee = data.landFee ? parseFloat(data.landFee) : null;
    if (data.shortletAmount !== undefined) updateData.shortletAmount = data.shortletAmount ? parseFloat(data.shortletAmount) : null;
    if (data.size !== undefined) updateData.size = data.size ? parseFloat(data.size) : null;
    if (data.bedrooms !== undefined) updateData.bedrooms = data.bedrooms ? parseInt(data.bedrooms) : null;
    if (data.bathrooms !== undefined) updateData.bathrooms = data.bathrooms ? parseFloat(data.bathrooms) : null;
    if (data.yearBuilt !== undefined) updateData.yearBuilt = data.yearBuilt ? parseInt(data.yearBuilt) : null;
    if (data.amenities !== undefined) {
      updateData.amenities = this.parseAmenities(data.amenities);
    }

    // If property was approved and user is not admin, set back to pending
    if (wasApproved && role !== Role.ADMIN) {
      updateData.listingStatus = PropertyListingStatus.PENDING;
      updateData.reviewedBy = null;
      updateData.reviewedAt = null;
      updateData.rejectionReason = null;
    }

    // Upload new media
    if (files && Object.keys(files).length > 0) {
      await this.uploadPropertyMediaInBackground(propertyId, files);
    }

    const updatedProperty = await prisma.property.update({
      where: { id: propertyId },
      data: updateData,
      include: {
        media: true,
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
            employeeId: true,
            department: true
          }
        }
      }
    });

    // If property was reset to pending, notify the vendor
    if (wasApproved && role !== Role.ADMIN) {
      await prisma.notification.create({
        data: {
          userId: property.vendorId,
          type: 'GENERAL',
          title: 'Property Update Requires Approval',
          message: `Your property "${property.name}" has been updated and requires admin approval again.`,
          data: { propertyId: property.id }
        }
      });
    }

    return {
      ...updatedProperty,
      priceDisplay: this.getPriceDisplay(updatedProperty)
    };
  }

  static async deleteProperty(userId: string, role: Role, propertyId: string) {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        media: true,
        documents: true
      }
    });

    if (!property) {
      throw new NotFoundError("Property not found");
    }

    let canDelete = false;
    if (role === Role.ADMIN) canDelete = true;
    if (role === Role.VENDOR && property.vendorId === userId) canDelete = true;

    if (!canDelete) {
      throw new ForbiddenError("You don't have permission to delete this property");
    }

    // Delete media files
    for (const media of property.media) {
      await deleteFile(media.key, media.container ?? undefined);
    }

    for (const doc of property.documents) {
      await deleteFile(doc.key, doc.container ?? undefined);
    }

    await prisma.property.delete({ where: { id: propertyId } });

    return { success: true };
  }

  static async getAvailableProperties(queryParams: {
    type?: string;
    listingType?: string;
    city?: string;
    state?: string;
    bedrooms?: string;
    minPrice?: string;
    maxPrice?: string;
    page?: number;
    limit?: number;
    status?: string;
  }) {
    const {
      type,
      listingType,
      city,
      state,
      bedrooms,
      minPrice,
      maxPrice,
      status,
      page = 1,
      limit = 12
    } = queryParams;

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = {
      listingStatus: PropertyListingStatus.ACTIVE,
    };

    if (status) {
      if (!this.validateStatus(status)) {
        throw new BadRequestError(
          `Invalid status. Must be one of: AVAILABLE, OCCUPIED, UNDER_MAINTENANCE, UNDER_CONSTRUCTION, SOLD, RENTED`
        );
      }
      where.status = status as PropertyStatus;
    } else {
      where.status = PropertyStatus.AVAILABLE;
    }


    if (type) where.type = type;
    if (listingType) where.listingType = listingType;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (state) where.state = { contains: state, mode: 'insensitive' };
    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };

    // Price filtering based on listing type
    if (minPrice || maxPrice) {
      const priceFilter: any = {};
      if (minPrice) priceFilter.gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice);

      if (listingType === ListingType.FOR_RENT) {
        where.rentAmount = priceFilter;
      } else if (listingType === ListingType.FOR_SALE) {
        where.salePrice = priceFilter;
      } else if (listingType === ListingType.FOR_LAND) {
        where.landFee = priceFilter;
      } else if (listingType === ListingType.FOR_SHORTLET) {
        where.shortletAmount = priceFilter;
      } else {
        where.OR = [
          { rentAmount: priceFilter },
          { salePrice: priceFilter },
          { landFee: priceFilter },
          { shortletAmount: priceFilter }
        ];
      }
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          media: {
            orderBy: { isPrimary: 'desc' }
          },
          vendor: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatar: true
            }
          }
        }
      }),
      prisma.property.count({ where })
    ]);

    const enrichedProperties = properties.map((property: any) => ({
      ...property,
      priceDisplay: this.getPriceDisplay(property)
    }));

    return {
      properties: enrichedProperties,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    };
  }
}