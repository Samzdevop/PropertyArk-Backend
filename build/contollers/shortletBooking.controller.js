"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelBooking = exports.checkOutGuest = exports.checkInGuest = exports.approveBooking = exports.getVendorBookingStats = exports.createBooking = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const shortletBooking_service_1 = require("../services/shortletBooking.service");
const activity_controller_1 = require("./activity.controller");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const client_1 = require("@prisma/client");
const createBooking = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId, firstName, lastName, email, phone, adult, child, checkInDate, checkOutDate, paymentMethod } = req.body;
        const booking = await shortletBooking_service_1.ShortletBookingService.createBooking({
            propertyId,
            firstName,
            lastName,
            email,
            phone,
            adult,
            child: child || 0,
            checkInDate,
            checkOutDate,
            paymentMethod,
            userId: user?.id
        });
        if (user) {
            await (0, activity_controller_1.logActivity)(user.id, 'CREATE_SHORTLET_BOOKING', 'BOOKING', booking.id, {
                bookingNumber: booking.bookingNumber,
                propertyId,
                totalAmount: booking.totalAmount
            }, req);
        }
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Booking created successfully. Awaiting vendor approval.", booking, 201);
    }
    catch (error) {
        next(error);
    }
};
exports.createBooking = createBooking;
const getVendorBookingStats = async (req, res, next) => {
    try {
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can view booking stats");
        }
        const stats = await shortletBooking_service_1.ShortletBookingService.getVendorBookingStats(user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'VIEW_BOOKING_STATS', 'BOOKING', 'stats', {
            total: stats.stats.total,
            pending: stats.stats.pending,
            upcoming: stats.stats.upcoming
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Booking stats retrieved successfully", stats);
    }
    catch (error) {
        next(error);
    }
};
exports.getVendorBookingStats = getVendorBookingStats;
const approveBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can approve bookings");
        }
        const booking = await shortletBooking_service_1.ShortletBookingService.approveBooking(bookingId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'APPROVE_BOOKING', 'BOOKING', bookingId, {
            bookingNumber: booking.bookingNumber,
            status: booking.status
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Booking approved successfully", booking);
    }
    catch (error) {
        next(error);
    }
};
exports.approveBooking = approveBooking;
const checkInGuest = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can check-in guests");
        }
        const booking = await shortletBooking_service_1.ShortletBookingService.checkInGuest(bookingId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'CHECK_IN_GUEST', 'BOOKING', bookingId, {
            bookingNumber: booking.bookingNumber,
            status: booking.status
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Guest checked-in successfully", booking);
    }
    catch (error) {
        next(error);
    }
};
exports.checkInGuest = checkInGuest;
const checkOutGuest = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const user = req.user;
        if (user.role !== client_1.Role.VENDOR && user.role !== client_1.Role.ADMIN) {
            throw new ForbiddenError_1.ForbiddenError("Only vendors and admins can check-out guests");
        }
        const booking = await shortletBooking_service_1.ShortletBookingService.checkOutGuest(bookingId, user.id);
        await (0, activity_controller_1.logActivity)(user.id, 'CHECK_OUT_GUEST', 'BOOKING', bookingId, {
            bookingNumber: booking.bookingNumber,
            status: booking.status
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Guest checked-out successfully", booking);
    }
    catch (error) {
        next(error);
    }
};
exports.checkOutGuest = checkOutGuest;
const cancelBooking = async (req, res, next) => {
    try {
        const { bookingId } = req.params;
        const user = req.user;
        const booking = await shortletBooking_service_1.ShortletBookingService.cancelBooking(bookingId, user?.id, user?.role);
        await (0, activity_controller_1.logActivity)(user?.id || 'anonymous', 'CANCEL_BOOKING', 'BOOKING', bookingId, {
            bookingNumber: booking.bookingNumber,
            status: booking.status
        }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Booking cancelled successfully", booking);
    }
    catch (error) {
        next(error);
    }
};
exports.cancelBooking = cancelBooking;
