"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyService = void 0;
const prisma_1 = __importDefault(require("../prisma"));
const client_1 = require("@prisma/client");
const BadRequestError_1 = require("../errors/BadRequestError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const NotFoundError_1 = require("../errors/NotFoundError");
const upload_1 = require("../config/upload");
const creditPoint_service_1 = require("./creditPoint.service");
// import { VendorService } from "./vendor.service";
class PropertyService {
    static parseHouseRules(houseRules) {
        if (!houseRules)
            return [];
        if (Array.isArray(houseRules)) {
            return houseRules.filter(Boolean).map((r) => String(r).trim());
        }
        if (typeof houseRules === "string") {
            const trimmed = houseRules.trim();
            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        return parsed.filter(Boolean).map((r) => String(r).trim());
                    }
                }
                catch {
                }
            }
            if (trimmed.includes(",")) {
                return trimmed.split(",").map((i) => i.trim()).filter(Boolean);
            }
            return [trimmed];
        }
        return [];
    }
    static isValidTime(time) {
        const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(time);
    }
    static parseBoolean(value, defaultValue = false) {
        if (value === undefined || value === null || value === '') {
            return defaultValue;
        }
        if (typeof value === 'boolean')
            return value;
        if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (lower === 'true' || lower === '1')
                return true;
            if (lower === 'false' || lower === '0')
                return false;
        }
        if (typeof value === 'number')
            return value !== 0;
        return defaultValue;
    }
    static validateShortletFields(data, listingType) {
        if (listingType !== client_1.ListingType.FOR_SHORTLET) {
            return;
        }
        const { checkInTime, checkOutTime } = data;
        if (checkInTime && !this.isValidTime(checkInTime)) {
            throw new BadRequestError_1.BadRequestError("Invalid check-in time format. Use HH:mm (e.g., 14:00)");
        }
        if (checkOutTime && !this.isValidTime(checkOutTime)) {
            throw new BadRequestError_1.BadRequestError("Invalid check-out time format. Use HH:mm (e.g., 11:00)");
        }
    }
    static parseAmenities(amenities) {
        if (!amenities)
            return [];
        if (typeof amenities === "string") {
            try {
                const parsed = JSON.parse(amenities);
                return Array.isArray(parsed) ? parsed : [parsed];
            }
            catch {
                return amenities.includes(",")
                    ? amenities.split(",").map((i) => i.trim())
                    : [amenities];
            }
        }
        if (Array.isArray(amenities)) {
            return amenities;
        }
        return [];
    }
    static validatePropertyPricing(data) {
        const { listingType, rentAmount, salePrice, landFee, shortletAmount } = data;
        switch (listingType) {
            case client_1.ListingType.FOR_RENT:
                if (!rentAmount || parseFloat(rentAmount) <= 0) {
                    throw new BadRequestError_1.BadRequestError("Rent amount is required for FOR_RENT properties");
                }
                break;
            case client_1.ListingType.FOR_SALE:
                if (!salePrice || parseFloat(salePrice) <= 0) {
                    throw new BadRequestError_1.BadRequestError("Sale price is required for FOR_SALE properties");
                }
                break;
            case client_1.ListingType.FOR_LAND:
                if (!landFee || parseFloat(landFee) <= 0) {
                    throw new BadRequestError_1.BadRequestError("Land fee is required for FOR_LAND properties");
                }
                break;
            case client_1.ListingType.FOR_SHORTLET:
                if (!shortletAmount || parseFloat(shortletAmount) <= 0) {
                    throw new BadRequestError_1.BadRequestError("Shortlet amount is required for FOR_SHORTLET properties");
                }
                break;
            default:
                throw new BadRequestError_1.BadRequestError("Invalid listing type");
        }
    }
    static validateStatus(status) {
        return Object.values(client_1.PropertyStatus).includes(status);
    }
    // static async createProperty(
    //   userId: string,
    //   userRole: Role,
    //   data: any,
    //   files: any
    // ) {
    //   const {
    //     name, description, type, listingType, address, city, state, country, zipCode,
    //     size, sizeUnit, bedrooms, bathrooms, yearBuilt, amenities,
    //     rentAmount, salePrice, landFee, shortletAmount, staffId, status, 
    //     checkInTime, checkOutTime, houseRules, cancellationPolicy
    //   } = data;
    //   let propertyStatus: PropertyStatus;
    //   if (!status) {
    //     throw new BadRequestError(
    //       `Status is required. Valid values: ${Object.values(PropertyStatus).join(', ')}`
    //     );
    //   }
    //   if (!this.validateStatus(status)) {
    //     throw new BadRequestError(
    //       `Invalid status "${status}". Must be one of: ${Object.values(PropertyStatus).join(', ')}`
    //     );
    //   }
    //   propertyStatus = status as PropertyStatus;
    //   this.validatePropertyPricing({ listingType, rentAmount, salePrice, landFee, shortletAmount });
    //   this.validateShortletFields({ checkInTime, checkOutTime }, listingType);
    //   const parsedAmenities = this.parseAmenities(amenities);
    //   const parsedHouseRules = this.parseHouseRules(houseRules);
    //   let vendorId = userId;
    //   let staffIdToUse = staffId || null;
    //   if (userRole === Role.STAFF) {
    //     if (!staffId) {
    //       throw new BadRequestError("Vendor ID is required when creating property as staff");
    //     }
    //     const vendor = await prisma.user.findUnique({
    //       where: { id: staffId, role: Role.VENDOR }
    //     });
    //     if (!vendor) {
    //       throw new NotFoundError("Vendor not found");
    //     }
    //     vendorId = staffId;
    //     staffIdToUse = userId;
    //   }
    //   if (userRole === Role.VENDOR) {
    //     const vendor = await prisma.user.findUnique({
    //       where: { 
    //         id: userId,
    //         role: Role.VENDOR 
    //       },
    //       select: { ninVerificationStatus: true }
    //     });
    //     if (!vendor) {
    //       throw new NotFoundError("Vendor not found");
    //     }
    //     if (vendor.ninVerificationStatus !== VerificationStatus.VERIFIED) {
    //       throw new ForbiddenError("Your NIN must be verified before you can list properties");
    //     }
    //     const check = await CreditPointService.canCreateProperty(userId);
    //     if (!check.canCreate) {
    //       throw new BadRequestError(check.message);
    //     }
    //     vendorId = userId;
    //   }
    //   const propertyData: any = {
    //     name,
    //     description,
    //     type,
    //     listingType,
    //     status: propertyStatus,
    //     listingStatus: PropertyListingStatus.PENDING,
    //     address,
    //     city,
    //     state,
    //     country,
    //     zipCode,
    //     size: size ? parseFloat(size) : null,
    //     sizeUnit: sizeUnit || 'sqft',
    //     bedrooms: bedrooms ? parseInt(bedrooms) : null,
    //     bathrooms: bathrooms ? parseFloat(bathrooms) : null,
    //     yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
    //     amenities: parsedAmenities,
    //     vendorId: vendorId,
    //     staffId: staffIdToUse
    //   };
    //   if (listingType === ListingType.FOR_SHORTLET) {
    //     propertyData.checkInTime = checkInTime || null;
    //     propertyData.checkOutTime = checkOutTime || null;
    //     propertyData.houseRules = parsedHouseRules.length > 0 ? parsedHouseRules : null;
    //     propertyData.cancellationPolicy = cancellationPolicy || null;
    //   }
    //   switch (listingType) {
    //     case ListingType.FOR_RENT:
    //       propertyData.rentAmount = parseFloat(rentAmount);
    //       break;
    //     case ListingType.FOR_SALE:
    //       propertyData.salePrice = parseFloat(salePrice);
    //       break;
    //     case ListingType.FOR_LAND:
    //       propertyData.landFee = parseFloat(landFee);
    //       break;
    //     case ListingType.FOR_SHORTLET:
    //       propertyData.shortletAmount = parseFloat(shortletAmount);
    //       break;
    //   }
    //   const property = await prisma.property.create({
    //     data: propertyData
    //   });
    //   if (userRole === Role.VENDOR) {
    //     try {
    //       await CreditPointService.deductCreditPoints(
    //         userId,
    //         (await CreditPointService.getSettings()).propertyCreationCost,
    //         'PROPERTY_CREATION',
    //         `Created property: ${property.name}`,
    //         { propertyId: property.id }
    //       );
    //     } catch (error) {
    //       // If point deduction fails, delete the property to maintain consistency
    //       await prisma.property.delete({ where: { id: property.id } });
    //       throw error;
    //     }
    //   }
    //   if (files && Object.keys(files).length > 0) {
    //     this.uploadPropertyMediaInBackground(property.id, files);
    //   }
    //   return property;
    // }
    static async createProperty(userId, userRole, data, files) {
        const { name, description, type, listingType, address, city, state, country, zipCode, size, sizeUnit, bedrooms, bathrooms, yearBuilt, amenities, rentAmount, salePrice, landFee, shortletAmount, staffId, status, checkInTime, checkOutTime, houseRules, cancellationPolicy, propertyLandMark, distance, furnished, rentDuration } = data;
        let propertyStatus;
        if (!status) {
            throw new BadRequestError_1.BadRequestError(`Status is required. Valid values: ${Object.values(client_1.PropertyStatus).join(', ')}`);
        }
        if (!this.validateStatus(status)) {
            throw new BadRequestError_1.BadRequestError(`Invalid status "${status}". Must be one of: ${Object.values(client_1.PropertyStatus).join(', ')}`);
        }
        propertyStatus = status;
        this.validatePropertyPricing({
            listingType,
            rentAmount,
            salePrice,
            landFee,
            shortletAmount
        });
        this.validateShortletFields({
            checkInTime,
            checkOutTime
        }, listingType);
        const parsedAmenities = this.parseAmenities(amenities);
        const parsedHouseRules = this.parseHouseRules(houseRules);
        let vendorId = userId;
        let staffIdToUse = staffId || null;
        // STAFF creating property for a VENDOR
        if (userRole === client_1.Role.STAFF) {
            if (!staffId) {
                throw new BadRequestError_1.BadRequestError("Vendor ID is required when creating property as staff");
            }
            const vendor = await prisma_1.default.user.findUnique({
                where: {
                    id: staffId,
                    role: client_1.Role.VENDOR
                }
            });
            if (!vendor) {
                throw new NotFoundError_1.NotFoundError("Vendor not found");
            }
            vendorId = staffId;
            staffIdToUse = userId;
        }
        // VENDOR creating their own property
        if (userRole === client_1.Role.VENDOR) {
            const vendor = await prisma_1.default.user.findUnique({
                where: {
                    id: userId,
                    role: client_1.Role.VENDOR
                },
                select: {
                    ninVerificationStatus: true
                }
            });
            if (!vendor) {
                throw new NotFoundError_1.NotFoundError("Vendor not found");
            }
            // NIN verification check
            if (vendor.ninVerificationStatus !== client_1.VerificationStatus.VERIFIED) {
                throw new ForbiddenError_1.ForbiddenError("Your NIN must be verified before you can list properties");
            }
            // Credit point check
            const check = await creditPoint_service_1.CreditPointService.canCreateProperty(userId);
            if (!check.canCreate) {
                throw new BadRequestError_1.BadRequestError(check.message);
            }
            vendorId = userId;
        }
        const propertyData = {
            name,
            description,
            type,
            listingType,
            status: propertyStatus,
            listingStatus: client_1.PropertyListingStatus.PENDING,
            address,
            city,
            state,
            country,
            zipCode,
            size: size ? parseFloat(size) : null,
            sizeUnit: sizeUnit || "sqft",
            bedrooms: bedrooms ? parseInt(bedrooms) : null,
            bathrooms: bathrooms ? parseFloat(bathrooms) : null,
            yearBuilt: yearBuilt ? parseInt(yearBuilt) : null,
            amenities: parsedAmenities,
            vendorId,
            staffId: staffIdToUse,
            propertyLandMark: propertyLandMark || null,
            distance: distance || null,
            furnished: this.parseBoolean(furnished, false),
        };
        if (listingType === client_1.ListingType.FOR_RENT) {
            if (rentDuration) {
                const validDurations = ['MONTHLY', 'YEARLY'];
                if (!validDurations.includes(rentDuration)) {
                    throw new BadRequestError_1.BadRequestError(`Invalid rent duration. Must be: ${validDurations.join(', ')}`);
                }
                propertyData.rentDuration = rentDuration;
            }
            else {
                propertyData.rentDuration = client_1.RentDuration.MONTHLY; // default
            }
        }
        else {
            propertyData.rentDuration = null;
        }
        if (listingType === client_1.ListingType.FOR_SHORTLET) {
            propertyData.checkInTime = checkInTime || null;
            propertyData.checkOutTime = checkOutTime || null;
            propertyData.houseRules =
                parsedHouseRules.length > 0 ? parsedHouseRules : null;
            propertyData.cancellationPolicy = cancellationPolicy || null;
        }
        switch (listingType) {
            case client_1.ListingType.FOR_RENT:
                propertyData.rentAmount = parseFloat(rentAmount);
                break;
            case client_1.ListingType.FOR_SALE:
                propertyData.salePrice = parseFloat(salePrice);
                break;
            case client_1.ListingType.FOR_LAND:
                propertyData.landFee = parseFloat(landFee);
                break;
            case client_1.ListingType.FOR_SHORTLET:
                propertyData.shortletAmount = parseFloat(shortletAmount);
                break;
        }
        const property = await prisma_1.default.property.create({
            data: propertyData
        });
        // Deduct credit points for vendor property creation
        if (userRole === client_1.Role.VENDOR) {
            try {
                const settings = await creditPoint_service_1.CreditPointService.getSettings();
                await creditPoint_service_1.CreditPointService.deductCreditPoints(userId, settings.propertyCreationCost, "PROPERTY_CREATION", `Created property: ${property.name}`, {
                    propertyId: property.id
                });
            }
            catch (error) {
                // Roll back property if credit deduction fails
                await prisma_1.default.property.delete({
                    where: {
                        id: property.id
                    }
                });
                throw error;
            }
        }
        if (files && Object.keys(files).length > 0) {
            this.uploadPropertyMediaInBackground(property.id, files);
        }
        return property;
    }
    static async uploadPropertyMediaInBackground(propertyId, files) {
        try {
            const mediaData = [];
            const uploadConfig = [
                { field: "photos", type: "IMAGE", container: upload_1.STORAGE_CONTAINERS.PROPERTY_PHOTOS },
                { field: "videos", type: "VIDEO", container: upload_1.STORAGE_CONTAINERS.PROPERTY_VIDEOS },
                { field: "documents", type: "DOCUMENT", container: upload_1.STORAGE_CONTAINERS.PROPERTY_DOCUMENTS }
            ];
            const storageDriver = process.env.STORAGE_DRIVER || 'local';
            for (const config of uploadConfig) {
                const fileGroup = files[config.field];
                if (!fileGroup || fileGroup.length === 0)
                    continue;
                let urls = [];
                if (storageDriver === 'azure') {
                    urls = await (0, upload_1.uploadMultipleToAzure)(fileGroup, config.container);
                }
                else if (storageDriver === 's3') {
                    // S3: Files already uploaded by multer-s3, get location from file
                    urls = fileGroup.map((file) => file.location || `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${file.key}`);
                }
                else {
                    // LOCAL: Files saved to disk, generate URL
                    urls = fileGroup.map((file) => {
                        // For local storage, multer saves files and provides filename
                        const filename = file.filename || file.key || file.originalname;
                        return `/uploads/${filename}`;
                    });
                }
                urls.forEach((url, index) => {
                    const file = fileGroup[index];
                    mediaData.push({
                        name: file.originalname,
                        type: config.type,
                        url: url,
                        key: url.split('/').pop() || file.filename || file.originalname,
                        size: file.size,
                        mimeType: file.mimetype,
                        container: config.container,
                        propertyId: propertyId,
                        isPrimary: index === 0 && config.field === "photos"
                    });
                });
            }
            if (mediaData.length > 0) {
                await prisma_1.default.media.createMany({ data: mediaData });
                console.log(`${mediaData.length} media files saved to database for property ${propertyId}`);
            }
        }
        catch (error) {
            console.error("Background upload failed:", error);
        }
    }
    static async getAllProperties(userId, role, queryParams) {
        const { page = 1, limit = 12, status, listingType, city, state, listingStatus } = queryParams;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {};
        if (role === client_1.Role.VENDOR) {
            where.vendorId = userId;
        }
        else if (role === client_1.Role.STAFF) {
            where.OR = [
                { staffId: userId },
                { vendorId: userId }
            ];
        }
        else if (role === client_1.Role.ADMIN) {
        }
        else if (role === client_1.Role.USER) {
            where.listingStatus = client_1.PropertyListingStatus.ACTIVE;
        }
        if (status)
            where.status = status;
        if (listingType)
            where.listingType = listingType;
        if (listingStatus && (role === client_1.Role.ADMIN || role === client_1.Role.VENDOR || role === client_1.Role.STAFF)) {
            where.listingStatus = listingStatus;
        }
        if (city)
            where.city = { contains: city, mode: 'insensitive' };
        if (state)
            where.state = { contains: state, mode: 'insensitive' };
        const [properties, total] = await Promise.all([
            prisma_1.default.property.findMany({
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
            prisma_1.default.property.count({ where })
        ]);
        // const enrichedProperties = properties.map((property:any) => ({
        //   ...property,
        //   priceDisplay: this.getPriceDisplay(property)
        // }));
        const enrichedProperties = await Promise.all(properties.map(async (property) => {
            let availability = [];
            const vendorId = property.vendorId;
            if (vendorId) {
                const allSlots = await prisma_1.default.vendorAvailability.findMany({
                    where: {
                        vendorId: vendorId,
                        isActive: true
                    },
                    orderBy: { date: 'asc' }
                });
                // Group by date
                const groupedSlots = {};
                allSlots.forEach(slot => {
                    const dateKey = slot.date.toISOString().split('T')[0];
                    if (!groupedSlots[dateKey]) {
                        groupedSlots[dateKey] = [];
                    }
                    groupedSlots[dateKey].push({
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        isActive: slot.isActive
                    });
                });
                availability = Object.entries(groupedSlots).map(([date, slots]) => ({
                    date,
                    slots
                }));
            }
            let bookedSlots = [];
            if (property.listingType === client_1.ListingType.FOR_SHORTLET) {
                bookedSlots = await this.getBookedSlots(property.id);
            }
            return {
                ...property,
                priceDisplay: this.getPriceDisplay(property),
                availability: availability,
                bookedSlots: bookedSlots
            };
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
    static async getMyProperties(userId, role, queryParams) {
        // Verify user is a vendor
        if (role !== client_1.Role.VENDOR && role !== client_1.Role.ADMIN) {
            throw new Error("Only vendors and admins can access this endpoint");
        }
        const { page = 1, limit = 10, status, listingStatus, listingType, search } = queryParams;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        // Build where clause
        const where = { vendorId: userId };
        if (status)
            where.status = status;
        if (listingStatus)
            where.listingStatus = listingStatus;
        if (listingType)
            where.listingType = listingType;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
                { state: { contains: search, mode: 'insensitive' } }
            ];
        }
        // Get all properties (for statistics) and paginated properties
        const [allProperties, properties, total] = await Promise.all([
            prisma_1.default.property.findMany({
                where: { vendorId: userId },
                select: {
                    id: true,
                    status: true,
                    listingStatus: true,
                    listingType: true,
                    rentAmount: true,
                    salePrice: true,
                    landFee: true,
                    shortletAmount: true,
                    viewCount: true,
                    inquiryCount: true,
                    createdAt: true
                }
            }),
            prisma_1.default.property.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    media: {
                        orderBy: { isPrimary: 'desc' },
                        take: 10
                    },
                    vendor: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                            avatar: true
                        }
                    },
                    // staff: {
                    //   select: {
                    //     id: true,
                    //     fullName: true,
                    //     email: true,
                    //     employeeId: true,
                    //     department: true
                    //   }
                    // },
                    _count: {
                        select: {
                            media: true,
                            inquiries: true,
                            favorites: true
                        }
                    }
                }
            }),
            prisma_1.default.property.count({ where })
        ]);
        // Calculate statistics
        const totalProperties = allProperties.length;
        const activeListings = allProperties.filter(p => p.listingStatus === client_1.PropertyListingStatus.ACTIVE).length;
        const pendingApproval = allProperties.filter(p => p.listingStatus === client_1.PropertyListingStatus.PENDING).length;
        const rejectedListings = allProperties.filter(p => p.listingStatus === client_1.PropertyListingStatus.REJECTED).length;
        // Calculate occupancy rate (properties with OCCUPIED or RENTED status)
        const occupiedProperties = allProperties.filter(p => p.status === client_1.PropertyStatus.OCCUPIED ||
            p.status === client_1.PropertyStatus.RENTED).length;
        const occupancyRate = totalProperties > 0
            ? Math.round((occupiedProperties / totalProperties) * 100)
            : 0;
        // Calculate sold rate
        const soldProperties = allProperties.filter(p => p.status === client_1.PropertyStatus.SOLD).length;
        const soldRate = totalProperties > 0
            ? Math.round((soldProperties / totalProperties) * 100)
            : 0;
        // Total properties summary
        const totalPropertiesSummary = [
            { TotalListing: totalProperties },
            { "Active Listing": activeListings },
            { "Pending Approval": pendingApproval },
            { "Occupancy rate": `${occupancyRate}%` },
            { "Sold rate": `${soldRate}%` }
        ];
        // Format properties for response
        const formattedProperties = properties.map(property => ({
            id: property.id,
            name: property.name,
            description: property.description,
            type: property.type,
            listingType: property.listingType,
            status: property.status,
            listingStatus: property.listingStatus,
            address: property.address,
            city: property.city,
            state: property.state,
            country: property.country,
            zipCode: property.zipCode,
            price: this.getPriceDisplay(property),
            amenities: property.amenities,
            size: property.size,
            sizeUnit: property.sizeUnit,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            yearBuilt: property.yearBuilt,
            viewCount: property.viewCount,
            inquiryCount: property.inquiryCount,
            createdAt: property.createdAt,
            updatedAt: property.updatedAt,
            media: property.media.map(m => ({
                id: m.id,
                name: m.name,
                type: m.type,
                url: m.url,
                isPrimary: m.isPrimary
            })),
            vendor: property.vendor,
            // staff: property.staff,
            _count: {
                media: property._count.media,
                inquiries: property._count.inquiries,
                favorites: property._count.favorites
            }
        }));
        return {
            totalProperties: totalPropertiesSummary,
            properties: formattedProperties,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit))
            }
        };
    }
    static async getPropertyCounts(vendorId) {
        const [total, active, pending, rejected] = await Promise.all([
            prisma_1.default.property.count({ where: { vendorId } }),
            prisma_1.default.property.count({
                where: {
                    vendorId,
                    listingStatus: client_1.PropertyListingStatus.ACTIVE
                }
            }),
            prisma_1.default.property.count({
                where: {
                    vendorId,
                    listingStatus: client_1.PropertyListingStatus.PENDING
                }
            }),
            prisma_1.default.property.count({
                where: {
                    vendorId,
                    listingStatus: client_1.PropertyListingStatus.REJECTED
                }
            })
        ]);
        return { total, active, pending, rejected };
    }
    static async getPropertiesByListingType(vendorId) {
        return prisma_1.default.property.groupBy({
            by: ['listingType'],
            where: { vendorId },
            _count: true
        });
    }
    static getPriceDisplay(property) {
        switch (property.listingType) {
            case client_1.ListingType.FOR_RENT:
                return property.rentAmount ? `${property.rentAmount.toLocaleString()}/month` : 'Contact for price';
            case client_1.ListingType.FOR_SALE:
                return property.salePrice ? `${property.salePrice.toLocaleString()}` : 'Contact for price';
            case client_1.ListingType.FOR_LAND:
                return property.landFee ? `${property.landFee.toLocaleString()}` : 'Contact for price';
            case client_1.ListingType.FOR_SHORTLET:
                return property.shortletAmount ? `${property.shortletAmount.toLocaleString()}/night` : 'Contact for price';
            default:
                return 'Contact for price';
        }
    }
    static async getBookedSlots(propertyId) {
        // Get all APPROVED and CHECKED_IN bookings for this property
        const bookings = await prisma_1.default.shortletBooking.findMany({
            where: {
                propertyId,
                status: {
                    in: [client_1.BookingStatus.APPROVED, client_1.BookingStatus.CHECKED_IN]
                }
            },
            select: {
                id: true,
                bookingNumber: true,
                checkInDate: true,
                checkOutDate: true,
                status: true,
                guestFirstName: true,
                guestLastName: true,
                guestEmail: true,
                guestPhone: true
            },
            orderBy: { checkInDate: 'asc' }
        });
        // Format booked slots
        return bookings.map(booking => ({
            id: booking.id,
            bookingNumber: booking.bookingNumber,
            checkInDate: booking.checkInDate,
            checkOutDate: booking.checkOutDate,
            status: booking.status,
            guestName: `${booking.guestFirstName} ${booking.guestLastName}`,
            guestEmail: booking.guestEmail,
            guestPhone: booking.guestPhone
        }));
    }
    static async getPropertyById(userId, role, propertyId) {
        const property = await prisma_1.default.property.findUnique({
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
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        // Check access based on role
        if (role === client_1.Role.USER) {
            if (property.listingStatus !== client_1.PropertyListingStatus.ACTIVE) {
                throw new ForbiddenError_1.ForbiddenError("This property is not available");
            }
        }
        if (role === client_1.Role.VENDOR && property.vendorId !== userId) {
            throw new ForbiddenError_1.ForbiddenError("You don't have access to this property");
        }
        // let availability = null;
        // if (property.vendor && property.listingStatus === PropertyListingStatus.ACTIVE) {
        //   // Get upcoming availability (next 7 days)
        //   const today = new Date();
        //   today.setHours(0, 0, 0, 0);
        //   const nextWeek = new Date(today);
        //   nextWeek.setDate(nextWeek.getDate() + 7);
        //   availability = await VendorService.getVendorAvailabilitySlots(
        //     property.vendorId,
        //     {
        //       startDate: today,
        //       endDate: nextWeek
        //     }
        //   );
        // }
        let availability = [];
        if (property.vendor && property.listingStatus === client_1.PropertyListingStatus.ACTIVE) {
            // Get ALL availability slots for this vendor
            const allSlots = await prisma_1.default.vendorAvailability.findMany({
                where: {
                    vendorId: property.vendorId,
                    isActive: true
                },
                orderBy: { date: 'asc' }
            });
            // Group by date
            const groupedSlots = {};
            allSlots.forEach(slot => {
                const dateKey = slot.date.toISOString().split('T')[0];
                if (!groupedSlots[dateKey]) {
                    groupedSlots[dateKey] = [];
                }
                groupedSlots[dateKey].push({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isActive: slot.isActive
                });
            });
            // Convert to array format
            availability = Object.entries(groupedSlots).map(([date, slots]) => ({
                date,
                slots
            }));
        }
        let bookedSlots = [];
        if (property.listingType === client_1.ListingType.FOR_SHORTLET) {
            bookedSlots = await this.getBookedSlots(propertyId);
        }
        return {
            ...property,
            priceDisplay: this.getPriceDisplay(property),
            availability: availability,
            bookedSlots: bookedSlots
        };
    }
    static async getPublicPropertyById(propertyId) {
        const property = await prisma_1.default.property.findUnique({
            where: {
                id: propertyId,
                listingStatus: client_1.PropertyListingStatus.ACTIVE
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
            throw new NotFoundError_1.NotFoundError("Property not found or not available");
        }
        // let availability = null;
        // if (property.vendor) {
        //   // Get upcoming availability (next 7 days)
        //   const today = new Date();
        //   today.setHours(0, 0, 0, 0);
        //   const nextWeek = new Date(today);
        //   nextWeek.setDate(nextWeek.getDate() + 7);
        //   availability = await VendorService.getVendorAvailabilitySlots(
        //     property.vendorId,
        //     {
        //       startDate: today,
        //       endDate: nextWeek
        //     }
        //   );
        // }
        let availability = [];
        if (property.vendor) {
            const allSlots = await prisma_1.default.vendorAvailability.findMany({
                where: {
                    vendorId: property.vendorId,
                    isActive: true
                },
                orderBy: { date: 'asc' }
            });
            // Group by date
            const groupedSlots = {};
            allSlots.forEach(slot => {
                const dateKey = slot.date.toISOString().split('T')[0];
                if (!groupedSlots[dateKey]) {
                    groupedSlots[dateKey] = [];
                }
                groupedSlots[dateKey].push({
                    startTime: slot.startTime,
                    endTime: slot.endTime,
                    isActive: slot.isActive
                });
            });
            availability = Object.entries(groupedSlots).map(([date, slots]) => ({
                date,
                slots
            }));
        }
        let bookedSlots = [];
        if (property.listingType === client_1.ListingType.FOR_SHORTLET) {
            bookedSlots = await this.getBookedSlots(propertyId);
        }
        return {
            ...property,
            priceDisplay: this.getPriceDisplay(property),
            availability: availability,
            bookedSlots: bookedSlots
        };
    }
    static async updateProperty(userId, role, propertyId, data, files) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            include: { vendor: true, staff: true }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        let canUpdate = false;
        if (role === client_1.Role.ADMIN)
            canUpdate = true;
        if (role === client_1.Role.VENDOR && property.vendorId === userId)
            canUpdate = true;
        if (role === client_1.Role.STAFF && property.staffId === userId)
            canUpdate = true;
        if (!canUpdate) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to update this property");
        }
        const wasApproved = property.listingStatus === client_1.PropertyListingStatus.ACTIVE;
        const wasRejected = property.listingStatus === client_1.PropertyListingStatus.REJECTED;
        const updateData = { ...data };
        if (data.propertyLandMark !== undefined) {
            updateData.propertyLandMark = data.propertyLandMark || null;
        }
        if (data.distance !== undefined) {
            updateData.distance = data.distance || null;
        }
        if (data.furnished !== undefined) {
            updateData.furnished = this.parseBoolean(data.furnished, true);
        }
        if (data.status !== undefined) {
            if (!this.validateStatus(data.status)) {
                throw new BadRequestError_1.BadRequestError(`Invalid status. Must be one of: AVAILABLE, OCCUPIED, UNDER_MAINTENANCE, UNDER_CONSTRUCTION, SOLD, RENTED`);
            }
            updateData.status = data.status;
        }
        const listingType = data.listingType || property.listingType;
        if (listingType === client_1.ListingType.FOR_RENT) {
            if (data.rentDuration !== undefined) {
                const validDurations = ['MONTHLY', 'YEARLY'];
                if (!validDurations.includes(data.rentDuration)) {
                    throw new BadRequestError_1.BadRequestError(`Invalid rent duration. Must be: ${validDurations.join(', ')}`);
                }
                updateData.rentDuration = data.rentDuration;
            }
        }
        else if (data.listingType !== undefined) {
            updateData.rentDuration = null;
        }
        if (listingType === client_1.ListingType.FOR_SHORTLET) {
            this.validateShortletFields({
                checkInTime: data.checkInTime !== undefined ? data.checkInTime : property.checkInTime,
                checkOutTime: data.checkOutTime !== undefined ? data.checkOutTime : property.checkOutTime
            }, listingType);
        }
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.listingType !== undefined)
            updateData.listingType = data.listingType;
        if (data.address !== undefined)
            updateData.address = data.address;
        if (data.city !== undefined)
            updateData.city = data.city;
        if (data.state !== undefined)
            updateData.state = data.state;
        if (data.country !== undefined)
            updateData.country = data.country;
        if (data.zipCode !== undefined)
            updateData.zipCode = data.zipCode;
        if (data.rentAmount !== undefined)
            updateData.rentAmount = data.rentAmount ? parseFloat(data.rentAmount) : null;
        if (data.salePrice !== undefined)
            updateData.salePrice = data.salePrice ? parseFloat(data.salePrice) : null;
        if (data.landFee !== undefined)
            updateData.landFee = data.landFee ? parseFloat(data.landFee) : null;
        if (data.shortletAmount !== undefined)
            updateData.shortletAmount = data.shortletAmount ? parseFloat(data.shortletAmount) : null;
        if (data.size !== undefined)
            updateData.size = data.size ? parseFloat(data.size) : null;
        if (data.bedrooms !== undefined)
            updateData.bedrooms = data.bedrooms ? parseInt(data.bedrooms) : null;
        if (data.bathrooms !== undefined)
            updateData.bathrooms = data.bathrooms ? parseFloat(data.bathrooms) : null;
        if (data.yearBuilt !== undefined)
            updateData.yearBuilt = data.yearBuilt ? parseInt(data.yearBuilt) : null;
        if (data.amenities !== undefined) {
            updateData.amenities = this.parseAmenities(data.amenities);
        }
        if (listingType === client_1.ListingType.FOR_SHORTLET) {
            if (data.checkInTime !== undefined) {
                updateData.checkInTime = data.checkInTime || null;
            }
            if (data.checkOutTime !== undefined) {
                updateData.checkOutTime = data.checkOutTime || null;
            }
            if (data.houseRules !== undefined) {
                const parsedRules = this.parseHouseRules(data.houseRules);
                updateData.houseRules = parsedRules.length > 0 ? parsedRules : null;
            }
            if (data.cancellationPolicy !== undefined) {
                updateData.cancellationPolicy = data.cancellationPolicy || null;
            }
        }
        // If property was approved and user is not admin, set back to pending
        if ((wasApproved || wasRejected) && role !== client_1.Role.ADMIN) {
            updateData.listingStatus = client_1.PropertyListingStatus.PENDING;
            updateData.reviewedBy = null;
            updateData.reviewedAt = null;
            updateData.rejectionReason = null;
        }
        // Upload new media
        if (files && Object.keys(files).length > 0) {
            await this.uploadPropertyMediaInBackground(propertyId, files);
        }
        const updatedProperty = await prisma_1.default.property.update({
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
        if ((wasApproved || wasRejected) && role !== client_1.Role.ADMIN) {
            const statusMessage = wasApproved
                ? 'updated and requires admin approval again'
                : 'resubmitted for admin review';
            await prisma_1.default.notification.create({
                data: {
                    userId: property.vendorId,
                    type: 'GENERAL',
                    title: wasApproved ? 'Property Update Requires Approval' : 'Property Resubmitted for Review',
                    message: `Your property "${property.name}" has been ${statusMessage}.`,
                    data: {
                        propertyId: property.id,
                        previousStatus: property.listingStatus,
                        newStatus: client_1.PropertyListingStatus.PENDING
                    }
                }
            });
        }
        return {
            ...updatedProperty,
            priceDisplay: this.getPriceDisplay(updatedProperty)
        };
    }
    static async deleteProperty(userId, role, propertyId) {
        const property = await prisma_1.default.property.findUnique({
            where: { id: propertyId },
            include: {
                media: true,
                documents: true
            }
        });
        if (!property) {
            throw new NotFoundError_1.NotFoundError("Property not found");
        }
        let canDelete = false;
        if (role === client_1.Role.ADMIN)
            canDelete = true;
        if (role === client_1.Role.VENDOR && property.vendorId === userId)
            canDelete = true;
        if (!canDelete) {
            throw new ForbiddenError_1.ForbiddenError("You don't have permission to delete this property");
        }
        // Delete media files
        for (const media of property.media) {
            await (0, upload_1.deleteFile)(media.key, media.container ?? undefined);
        }
        for (const doc of property.documents) {
            await (0, upload_1.deleteFile)(doc.key, doc.container ?? undefined);
        }
        await prisma_1.default.property.delete({ where: { id: propertyId } });
        return { success: true };
    }
    static async getAvailableProperties(queryParams) {
        const { type, listingType, city, state, bedrooms, minPrice, maxPrice, status, page = 1, limit = 12 } = queryParams;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);
        const where = {
            listingStatus: client_1.PropertyListingStatus.ACTIVE,
        };
        if (status) {
            if (!this.validateStatus(status)) {
                throw new BadRequestError_1.BadRequestError(`Invalid status. Must be one of: AVAILABLE, OCCUPIED, UNDER_MAINTENANCE, UNDER_CONSTRUCTION, SOLD, RENTED`);
            }
            where.status = status;
        }
        else {
            where.status = client_1.PropertyStatus.AVAILABLE;
        }
        if (type)
            where.type = type;
        if (listingType)
            where.listingType = listingType;
        if (city)
            where.city = { contains: city, mode: 'insensitive' };
        if (state)
            where.state = { contains: state, mode: 'insensitive' };
        if (bedrooms)
            where.bedrooms = { gte: parseInt(bedrooms) };
        // Price filtering based on listing type
        if (minPrice || maxPrice) {
            const priceFilter = {};
            if (minPrice)
                priceFilter.gte = parseFloat(minPrice);
            if (maxPrice)
                priceFilter.lte = parseFloat(maxPrice);
            if (listingType === client_1.ListingType.FOR_RENT) {
                where.rentAmount = priceFilter;
            }
            else if (listingType === client_1.ListingType.FOR_SALE) {
                where.salePrice = priceFilter;
            }
            else if (listingType === client_1.ListingType.FOR_LAND) {
                where.landFee = priceFilter;
            }
            else if (listingType === client_1.ListingType.FOR_SHORTLET) {
                where.shortletAmount = priceFilter;
            }
            else {
                where.OR = [
                    { rentAmount: priceFilter },
                    { salePrice: priceFilter },
                    { landFee: priceFilter },
                    { shortletAmount: priceFilter }
                ];
            }
        }
        const [properties, total] = await Promise.all([
            prisma_1.default.property.findMany({
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
            prisma_1.default.property.count({ where })
        ]);
        // const enrichedProperties = properties.map((property: any) => ({
        //   ...property,
        //   priceDisplay: this.getPriceDisplay(property)
        // }));
        const enrichedProperties = await Promise.all(properties.map(async (property) => {
            let availability = [];
            if (property.vendor) {
                const allSlots = await prisma_1.default.vendorAvailability.findMany({
                    where: {
                        vendorId: property.vendorId,
                        isActive: true
                    },
                    orderBy: { date: 'asc' }
                });
                // Group by date
                const groupedSlots = {};
                allSlots.forEach(slot => {
                    const dateKey = slot.date.toISOString().split('T')[0];
                    if (!groupedSlots[dateKey]) {
                        groupedSlots[dateKey] = [];
                    }
                    groupedSlots[dateKey].push({
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        isActive: slot.isActive
                    });
                });
                availability = Object.entries(groupedSlots).map(([date, slots]) => ({
                    date,
                    slots
                }));
            }
            let bookedSlots = [];
            if (property.listingType === client_1.ListingType.FOR_SHORTLET) {
                bookedSlots = await this.getBookedSlots(property.id);
            }
            return {
                ...property,
                priceDisplay: this.getPriceDisplay(property),
                availability: availability,
                bookedSlots: bookedSlots
            };
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
exports.PropertyService = PropertyService;
