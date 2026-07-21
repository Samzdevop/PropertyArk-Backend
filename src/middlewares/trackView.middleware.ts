import { Request, Response, NextFunction } from "express";
import { ViewTrackingService } from "../services/viewTracking.service";


export const trackPropertyView = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const propertyId = req.params.id || req.params.propertyId;
    
    if (!propertyId) {
      return next();
    }
    const userId = (req as any).user?.id;

    // Track the view in the background (don't await)
    setImmediate(() => {
      ViewTrackingService.trackView(propertyId as string, userId).catch(error => {
        console.error('View tracking error:', error);
      });
    });

    next();
  } catch (error) {
    // Don't block the request if view tracking fails
    next();
  }
};

/**
 * Middleware to track views for multiple properties (list endpoints)
 * This is a lighter version that tracks views in the background
 */
export const trackMultiplePropertyViews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // This is a placeholder - for list endpoints, we'll track views
    // on the detail endpoint instead to avoid duplicates
    next();
  } catch (error) {
    next();
  }
};