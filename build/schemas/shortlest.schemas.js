"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingIdSchema = exports.createBookingSchema = void 0;
const zod_1 = require("zod");
exports.createBookingSchema = zod_1.z.object({
    body: zod_1.z.object({
        propertyId: zod_1.z.string().cuid("Invalid property ID"),
        firstName: zod_1.z.string().min(1, "Full name is required"),
        lastName: zod_1.z.string().min(1, "Last name is required"),
        email: zod_1.z.string().email("Invalid email format"),
        phone: zod_1.z.string().optional(),
        adult: zod_1.z.number().min(1, "At least 1 adult is required"),
        child: zod_1.z.number().min(0).default(0),
        checkInDate: zod_1.z.string().refine((val) => {
            const date = new Date(val);
            return !isNaN(date.getTime());
        }, { message: "Invalid check-in date format. Use YYYY-MM-DD or ISO datetime" }),
        checkOutDate: zod_1.z.string().refine((val) => {
            const date = new Date(val);
            return !isNaN(date.getTime());
        }, { message: "Invalid check-out date format. Use YYYY-MM-DD or ISO datetime" }),
        paymentMethod: zod_1.z.enum(["CASH", "TRANSFER"])
    })
});
exports.bookingIdSchema = zod_1.z.object({
    params: zod_1.z.object({
        bookingId: zod_1.z.string().cuid("Invalid booking ID")
    })
});
