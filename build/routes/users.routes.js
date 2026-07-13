"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const users_schemas_1 = require("../schemas/users.schemas");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const users_controller_1 = require("../contollers/users.controller");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.get('/profile', errorHandler_middleware_1.authenticateJWT, users_controller_1.getProfile);
exports.usersRouter.patch('/change-password', errorHandler_middleware_1.authenticateJWT, (0, validateRequest_middleware_1.validateRequest)(users_schemas_1.changePasswordSchema), users_controller_1.changePassword);
exports.usersRouter.get('/', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), users_controller_1.getAllUsers);
// usersRouter.get(
// 	'/:userId',
// 	authenticateJWT,
// 	requireRoles(['ADMIN']),
// 	getUserById
// );
exports.usersRouter.delete('/:userId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), users_controller_1.deleteUser);
