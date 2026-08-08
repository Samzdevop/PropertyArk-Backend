"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveRejectPropertySchema = exports.getPropertyMediaSchema = exports.bulkDeleteMediaSchema = exports.updateMediaSchema = exports.myPropertiesQuerySchema = exports.reviewPropertySchema = exports.updatePropertySchema = exports.createPropertySchema = void 0;
const zod_1 = require("zod");
const PropertyTypeEnum = zod_1.z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE']);
const ListingTypeEnum = zod_1.z.enum(['FOR_RENT', 'FOR_SALE', 'FOR_LAND', 'FOR_SHORTLET']);
const PropertyStatusEnum = zod_1.z.enum([
    'AVAILABLE',
    'OCCUPIED',
    'UNDER_MAINTENANCE',
    'UNDER_CONSTRUCTION',
    'SOLD',
    'RENTED'
]);
exports.createPropertySchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Property name is required'),
        description: zod_1.z.string().optional(),
        type: zod_1.z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE']),
        listingType: ListingTypeEnum,
        status: PropertyStatusEnum.optional().default('AVAILABLE'),
        address: zod_1.z.string().min(1, 'Address is required'),
        city: zod_1.z.string().min(1, 'City is required'),
        state: zod_1.z.string().min(1, 'State is required'),
        country: zod_1.z.string().min(1, 'Country is required'),
        zipCode: zod_1.z.string().min(1, 'Zip code is required'),
        size: zod_1.z.string().optional(),
        sizeUnit: zod_1.z.string().default('sqft'),
        bedrooms: zod_1.z.string().optional(),
        bathrooms: zod_1.z.string().optional(),
        yearBuilt: zod_1.z.string().optional(),
        amenities: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        staffId: zod_1.z.string().optional(),
        rentAmount: zod_1.z.string().optional(),
        salePrice: zod_1.z.string().optional(),
        landFee: zod_1.z.string().optional(),
        shortletAmount: zod_1.z.string().optional(),
    }).refine((data) => {
        switch (data.listingType) {
            case 'FOR_RENT':
                return data.rentAmount && parseFloat(data.rentAmount) > 0;
            case 'FOR_SALE':
                return data.salePrice && parseFloat(data.salePrice) > 0;
            case 'FOR_LAND':
                return data.landFee && parseFloat(data.landFee) > 0;
            case 'FOR_SHORTLET':
                return data.shortletAmount && parseFloat(data.shortletAmount) > 0;
            default:
                return true;
        }
    }, {
        message: "Pricing is required based on listing type",
        path: ["pricing"]
    })
});
exports.updatePropertySchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid()
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        description: zod_1.z.string().optional(),
        listingType: ListingTypeEnum.optional(),
        status: PropertyStatusEnum.optional(),
        address: zod_1.z.string().min(1).optional(),
        city: zod_1.z.string().min(1).optional(),
        state: zod_1.z.string().min(1).optional(),
        country: zod_1.z.string().min(1).optional(),
        zipCode: zod_1.z.string().min(1).optional(),
        size: zod_1.z.string().optional(),
        bedrooms: zod_1.z.string().optional(),
        bathrooms: zod_1.z.string().optional(),
        amenities: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
        rentAmount: zod_1.z.string().optional(),
        salePrice: zod_1.z.string().optional(),
        landFee: zod_1.z.string().optional(),
        shortletAmount: zod_1.z.string().optional(),
    }).partial()
});
exports.reviewPropertySchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid('Invalid property ID')
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(['accept', 'reject']),
        rejectionReason: zod_1.z.string().optional()
    }).refine((data) => {
        if (data.status === 'reject' && !data.rejectionReason) {
            return false;
        }
        return true;
    }, {
        message: "Rejection reason is required when rejecting a property",
        path: ["rejectionReason"]
    })
});
exports.myPropertiesQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('10').transform(val => parseInt(val)),
        status: zod_1.z.enum(['AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE', 'UNDER_CONSTRUCTION', 'SOLD', 'RENTED']).optional(),
        listingStatus: zod_1.z.enum(['PENDING', 'ACTIVE', 'REJECTED']).optional(),
        listingType: zod_1.z.enum(['FOR_RENT', 'FOR_SALE', 'FOR_LAND', 'FOR_SHORTLET']).optional(),
        search: zod_1.z.string().optional()
    })
});
exports.updateMediaSchema = zod_1.z.object({
    params: zod_1.z.object({
        mediaId: zod_1.z.string().cuid('Invalid media ID')
    }),
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Media name is required')
    })
});
exports.bulkDeleteMediaSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid('Invalid property ID')
    }),
    body: zod_1.z.object({
        mediaIds: zod_1.z.array(zod_1.z.string().cuid()).min(1, 'At least one media ID is required')
    })
});
exports.getPropertyMediaSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid('Invalid property ID')
    }),
    query: zod_1.z.object({
        type: zod_1.z.enum(['image', 'video', 'doc']).optional()
    })
});
exports.approveRejectPropertySchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().cuid('Invalid property ID')
    }),
    body: zod_1.z.object({
        rejectionReason: zod_1.z.string().optional()
    })
});
