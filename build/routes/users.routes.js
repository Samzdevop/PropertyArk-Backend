"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const users_controllers_1 = require("../contollers/users.controllers");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const users_schemas_1 = require("../schemas/users.schemas");
const roleCheck_1 = require("../middlewares/roleCheck");
const auth_controller_1 = require("../contollers/auth.controller");
exports.usersRouter = (0, express_1.Router)();
exports.usersRouter.get('/profile', errorHandler_1.authenticateJWT, users_controllers_1.getProfile);
exports.usersRouter.patch('/update', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(users_schemas_1.updateUserSchema), users_controllers_1.updateUserProfile);
exports.usersRouter.patch('/change-password', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(users_schemas_1.changePasswordSchema), auth_controller_1.changePassword);
// usersRouter.patch(
// 	'/update',
// 	authenticateJWT,
// 	validateRequest(updateUserSchema),
// 	updateProfile
// );
exports.usersRouter.get('/', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), users_controllers_1.getAllUsers);
exports.usersRouter.get('/:userId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), users_controllers_1.getUserById);
exports.usersRouter.delete('/:userId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), users_controllers_1.deleteUser);
exports.usersRouter.patch('/:userId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN']), (0, validateRequest_1.validateRequest)(users_schemas_1.adminUpdateUserSchema), users_controllers_1.adminUpdateUser);
exports.usersRouter.get('/vet/assigned-farms', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['VET']), users_controllers_1.getVetAssignedFarms);
exports.usersRouter.get('/vet/farms/:companyId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['VET']), users_controllers_1.getFarmDetails);
