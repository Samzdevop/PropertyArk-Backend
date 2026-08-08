import { z } from 'zod';

export const setAvailabilitySchema = z.object({
  body: z.object({
    slots: z.array(z.object({
      date: z.string().datetime({ message: "Invalid date format. Use ISO format." }),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
      isRecurring: z.boolean().optional(),
      dayOfWeek: z.number().min(0).max(6).optional()
    }))
  })
});


export const addAvailabilitySchema = z.object({
  body: z.object({
    date: z.string().datetime({ message: "Invalid date format. Use ISO format." }),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format. Use HH:mm"),
    isRecurring: z.boolean().optional(),
    dayOfWeek: z.number().min(0).max(6).optional()
  })
});


export const getAvailabilitySchema = z.object({
  query: z.object({
    startDate: z.string().optional().refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Invalid date format. Use YYYY-MM-DD or ISO datetime" }
    ),
    endDate: z.string().optional().refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Invalid date format. Use YYYY-MM-DD or ISO datetime" }
    )
  })
});

export const getAvailableSlotsSchema = z.object({
  params: z.object({
    vendorId: z.string().cuid()
  }),
  query: z.object({
        date: z.string().refine(
      (val) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Invalid date format. Use YYYY-MM-DD or ISO datetime" }
    )
  })
});