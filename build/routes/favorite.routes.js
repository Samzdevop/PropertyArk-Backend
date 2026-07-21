"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.favoriteRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const favorite_controller_1 = require("../contollers/favorite.controller");
exports.favoriteRouter = (0, express_1.Router)();
// Add to favorites
exports.favoriteRouter.post('/:propertyId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER', 'VENDOR', 'ADMIN']), favorite_controller_1.addFavorite);
// Remove from favorites
exports.favoriteRouter.delete('/:propertyId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER', 'VENDOR', 'ADMIN']), favorite_controller_1.removeFavorite);
// Get user's favorites
exports.favoriteRouter.get('/', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER', 'VENDOR', 'ADMIN']), favorite_controller_1.getFavorites);
// Check if property is in favorites
exports.favoriteRouter.get('/check/:propertyId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['USER', 'VENDOR', 'ADMIN']), favorite_controller_1.checkFavorite);
