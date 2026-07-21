import { NextFunction, Request, Response } from "express";
import { sendSuccessResponse } from "../utils/sendSuccessResponse";
import { FavoriteService } from "../services/favorite.service";
import { logActivity } from "./activity.controller";
import { BadRequestError } from "../errors/BadRequestError";


export const addFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { propertyId } = req.params;

    const favorite = await FavoriteService.addFavorite(user.id, propertyId as string);

    await logActivity(
      user.id,
      'ADD_FAVORITE',
      'PROPERTY',
      propertyId as string,
      { propertyName: favorite.property.name },
      req
    );

    sendSuccessResponse(res, "Property added to favorites", favorite);
  } catch (error) {
    next(error);
  }
};


export const removeFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { propertyId } = req.params;

    await FavoriteService.removeFavorite(user.id, propertyId as string);

    await logActivity(
      user.id,
      'REMOVE_FAVORITE',
      'PROPERTY',
      propertyId as string,
      {},
      req
    );

    sendSuccessResponse(res, "Property removed from favorites");
  } catch (error) {
    next(error);
  }
};


export const getFavorites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { page = 1, limit = 20 } = req.query;

    const result = await FavoriteService.getUserFavorites(
      user.id,
      Number(page),
      Number(limit)
    );

    sendSuccessResponse(res, "Favorites retrieved successfully", result);
  } catch (error) {
    next(error);
  }
};


export const checkFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as any;
    const { propertyId } = req.params;

    const isFavorite = await FavoriteService.isFavorite(user.id, propertyId as string);

    sendSuccessResponse(res, "Favorite status checked", { isFavorite });
  } catch (error) {
    next(error);
  }
};