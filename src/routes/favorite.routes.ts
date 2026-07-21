import { Router } from "express";
import { authenticateJWT } from "../middlewares/errorHandler.middleware";
import { requireRoles } from "../middlewares/roleCheck.middleware";
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  checkFavorite
} from "../contollers/favorite.controller";

export const favoriteRouter = Router();

// Add to favorites
favoriteRouter.post(
  '/:propertyId',
  authenticateJWT,
  requireRoles(['USER', 'VENDOR', 'ADMIN']),
  addFavorite
);

// Remove from favorites
favoriteRouter.delete(
  '/:propertyId',
  authenticateJWT,
  requireRoles(['USER', 'VENDOR', 'ADMIN']),
  removeFavorite
);

// Get user's favorites
favoriteRouter.get(
  '/',
  authenticateJWT,
  requireRoles(['USER', 'VENDOR', 'ADMIN']),
  getFavorites
);

// Check if property is in favorites
favoriteRouter.get(
  '/check/:propertyId',
  authenticateJWT,
  requireRoles(['USER', 'VENDOR', 'ADMIN']),
  checkFavorite
);