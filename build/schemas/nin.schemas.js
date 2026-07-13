"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyNINSchema = void 0;
const zod_1 = require("zod");
exports.verifyNINSchema = zod_1.z.object({
    params: zod_1.z.object({
        vendorId: zod_1.z.string().cuid('Invalid vendor ID')
    }),
    body: zod_1.z.object({
        status: zod_1.z.enum(['VERIFIED', 'REJECTED']),
        rejectionReason: zod_1.z.string().optional()
    }).refine((data) => {
        if (data.status === 'REJECTED' && !data.rejectionReason) {
            return false;
        }
        return true;
    }, {
        message: "Rejection reason is required when rejecting NIN",
        path: ["rejectionReason"]
    })
});
