"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trackMultiplePropertyViews = exports.trackPropertyView = void 0;
const viewTracking_service_1 = require("../services/viewTracking.service");
const trackPropertyView = async (req, res, next) => {
    try {
        const propertyId = req.params.id || req.params.propertyId;
        if (!propertyId) {
            return next();
        }
        const userId = req.user?.id;
        // Track the view in the background (don't await)
        setImmediate(() => {
            viewTracking_service_1.ViewTrackingService.trackView(propertyId, userId).catch(error => {
                console.error('View tracking error:', error);
            });
        });
        next();
    }
    catch (error) {
        // Don't block the request if view tracking fails
        next();
    }
};
exports.trackPropertyView = trackPropertyView;
/**
 * Middleware to track views for multiple properties (list endpoints)
 * This is a lighter version that tracks views in the background
 */
const trackMultiplePropertyViews = async (req, res, next) => {
    try {
        // This is a placeholder - for list endpoints, we'll track views
        // on the detail endpoint instead to avoid duplicates
        next();
    }
    catch (error) {
        next();
    }
};
exports.trackMultiplePropertyViews = trackMultiplePropertyViews;
