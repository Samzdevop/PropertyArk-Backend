"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFavorite = exports.getFavorites = exports.removeFavorite = exports.addFavorite = void 0;
const sendSuccessResponse_1 = require("../utils/sendSuccessResponse");
const favorite_service_1 = require("../services/favorite.service");
const activity_controller_1 = require("./activity.controller");
const addFavorite = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId } = req.params;
        const favorite = await favorite_service_1.FavoriteService.addFavorite(user.id, propertyId);
        await (0, activity_controller_1.logActivity)(user.id, 'ADD_FAVORITE', 'PROPERTY', propertyId, { propertyName: favorite.property.name }, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property added to favorites", favorite);
    }
    catch (error) {
        next(error);
    }
};
exports.addFavorite = addFavorite;
const removeFavorite = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId } = req.params;
        await favorite_service_1.FavoriteService.removeFavorite(user.id, propertyId);
        await (0, activity_controller_1.logActivity)(user.id, 'REMOVE_FAVORITE', 'PROPERTY', propertyId, {}, req);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Property removed from favorites");
    }
    catch (error) {
        next(error);
    }
};
exports.removeFavorite = removeFavorite;
const getFavorites = async (req, res, next) => {
    try {
        const user = req.user;
        const { page = 1, limit = 20 } = req.query;
        const result = await favorite_service_1.FavoriteService.getUserFavorites(user.id, Number(page), Number(limit));
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Favorites retrieved successfully", result);
    }
    catch (error) {
        next(error);
    }
};
exports.getFavorites = getFavorites;
const checkFavorite = async (req, res, next) => {
    try {
        const user = req.user;
        const { propertyId } = req.params;
        const isFavorite = await favorite_service_1.FavoriteService.isFavorite(user.id, propertyId);
        (0, sendSuccessResponse_1.sendSuccessResponse)(res, "Favorite status checked", { isFavorite });
    }
    catch (error) {
        next(error);
    }
};
exports.checkFavorite = checkFavorite;
