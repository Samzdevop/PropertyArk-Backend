"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyManagementStatsSchema = void 0;
const zod_1 = require("zod");
exports.propertyManagementStatsSchema = zod_1.z.object({
    query: zod_1.z.object({
        page: zod_1.z.string().optional().default('1').transform(val => parseInt(val)),
        limit: zod_1.z.string().optional().default('20').transform(val => parseInt(val)),
        status: zod_1.z.enum(['PENDING', 'ACTIVE', 'REJECTED']).optional(),
        listingType: zod_1.z.enum(['FOR_RENT', 'FOR_SALE', 'FOR_LAND', 'FOR_SHORTLET']).optional(),
        search: zod_1.z.string().optional()
    })
});
