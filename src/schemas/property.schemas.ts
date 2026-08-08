import { z } from 'zod';

const PropertyTypeEnum = z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE']);
const ListingTypeEnum = z.enum(['FOR_RENT', 'FOR_SALE', 'FOR_LAND', 'FOR_SHORTLET']);
const PropertyStatusEnum = z.enum([
  'AVAILABLE', 
  'OCCUPIED', 
  'UNDER_MAINTENANCE', 
  'UNDER_CONSTRUCTION', 
  'SOLD', 
  'RENTED'
]);

export const createPropertySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Property name is required'),
    description: z.string().optional(),
    type: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE']),
    listingType: ListingTypeEnum,
    status: PropertyStatusEnum.optional().default('AVAILABLE'), 
    address: z.string().min(1, 'Address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    country: z.string().min(1, 'Country is required'),
    zipCode: z.string().min(1, 'Zip code is required'),
    size: z.string().optional(),
    sizeUnit: z.string().default('sqft'),
    bedrooms: z.string().optional(),
    bathrooms: z.string().optional(),
    yearBuilt: z.string().optional(),
    amenities: z.union([z.string(), z.array(z.string())]).optional(),
    staffId: z.string().optional(),
    rentAmount: z.string().optional(),
    salePrice: z.string().optional(),
    landFee: z.string().optional(),
    shortletAmount: z.string().optional(),
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

export const updatePropertySchema = z.object({
  params: z.object({
    id: z.string().cuid()
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    listingType: ListingTypeEnum.optional(),
    status: PropertyStatusEnum.optional(),
    address: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
    zipCode: z.string().min(1).optional(),
    size: z.string().optional(),
    bedrooms: z.string().optional(),
    bathrooms: z.string().optional(),
    amenities: z.union([z.string(), z.array(z.string())]).optional(),
    rentAmount: z.string().optional(),
    salePrice: z.string().optional(),
    landFee: z.string().optional(),
    shortletAmount: z.string().optional(),
  }).partial()
});

export const reviewPropertySchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid property ID')
  }),
  body: z.object({
    status: z.enum(['accept', 'reject']),
    rejectionReason: z.string().optional()
  }).refine(
    (data) => {
      if (data.status === 'reject' && !data.rejectionReason) {
        return false;
      }
      return true;
    },
    {
      message: "Rejection reason is required when rejecting a property",
      path: ["rejectionReason"]
    }
  )
});

export const myPropertiesQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().default('1').transform(val => parseInt(val)),
    limit: z.string().optional().default('10').transform(val => parseInt(val)),
    status: z.enum(['AVAILABLE', 'OCCUPIED', 'UNDER_MAINTENANCE', 'UNDER_CONSTRUCTION', 'SOLD', 'RENTED']).optional(),
    listingStatus: z.enum(['PENDING', 'ACTIVE', 'REJECTED']).optional(),
    listingType: z.enum(['FOR_RENT', 'FOR_SALE', 'FOR_LAND', 'FOR_SHORTLET']).optional(),
    search: z.string().optional()
  })
});


export const updateMediaSchema = z.object({
  params: z.object({
    mediaId: z.string().cuid('Invalid media ID')
  }),
  body: z.object({
    name: z.string().min(1, 'Media name is required')
  })
});

export const bulkDeleteMediaSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid property ID')
  }),
  body: z.object({
    mediaIds: z.array(z.string().cuid()).min(1, 'At least one media ID is required')
  })
});

export const getPropertyMediaSchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid property ID')
  }),
  query: z.object({
    type: z.enum(['image', 'video', 'doc']).optional()
  })
});

export const approveRejectPropertySchema = z.object({
  params: z.object({
    id: z.string().cuid('Invalid property ID')
  }),
  body: z.object({
    rejectionReason: z.string().optional()
  })
});