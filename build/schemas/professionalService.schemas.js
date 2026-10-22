"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfessionalServicesQuerySchema = exports.createProfessionalServiceSchema = void 0;
const zod_1 = require("zod");
const ServiceTypeEnum = zod_1.z.enum([
    'ACCOUNTANT',
    'LEGAL',
    'MORTAGE_BROKER',
    'INSURANCE',
    'PROPERTY_DEVELOPER',
]);
const ContactStatusEnum = zod_1.z.enum(['UNREAD', 'READ', 'REPLIED', 'ARCHIVED']);
const isValidDateString = (val) => {
    if (!val)
        return false;
    const d = new Date(val);
    if (!isNaN(d.getTime()))
        return true;
    return false;
};
exports.createProfessionalServiceSchema = zod_1.z.object({
    body: zod_1.z.object({
        fullName: zod_1.z.string().min(1, 'Full name is required').max(100),
        email: zod_1.z.string().email('Invalid email format'),
        phone: zod_1.z.string().optional(),
        serviceType: ServiceTypeEnum,
        consultationDate: zod_1.z.string().refine(isValidDateString, {
            message: 'Invalid date. Use YYYY-MM-DD or ISO format',
        }),
        propertyReference: zod_1.z.string().optional(),
        message: zod_1.z.string().min(10, 'Message must be at least 10 characters').max(2000),
    }),
});
exports.getProfessionalServicesQuerySchema = zod_1.z.object({
    query: zod_1.z.object({
        status: ContactStatusEnum.optional(),
        serviceType: ServiceTypeEnum.optional(),
        search: zod_1.z.string().optional(),
        page: zod_1.z.string().optional().default('1').transform(v => parseInt(v)),
        limit: zod_1.z.string().optional().default('20').transform(v => parseInt(v)),
    }),
});
