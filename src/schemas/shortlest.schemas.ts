import { z } from "zod";


export const createBookingSchema = z.object({
  body: z.object({
    propertyId: z.string().cuid("Invalid property ID"),
    firstName: z.string().min(1, "Full name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().optional(),
    adult: z.number().min(1, "At least 1 adult is required"),
    child: z.number().min(0).default(0),
    checkInDate: z.string().refine(
      (val) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Invalid check-in date format. Use YYYY-MM-DD or ISO datetime" }
    ),
    checkOutDate: z.string().refine(
      (val) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Invalid check-out date format. Use YYYY-MM-DD or ISO datetime" }
    ),
    paymentMethod: z.enum(["CASH", "TRANSFER"])
  })
});

export const bookingIdSchema = z.object({
  params: z.object({
    bookingId: z.string().cuid("Invalid booking ID")
  })
});
