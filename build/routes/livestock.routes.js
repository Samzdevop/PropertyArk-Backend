"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.livestockRouter = void 0;
const express_1 = require("express");
const livestock_controller_1 = require("../contollers/livestock.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const livestock_schemas_1 = require("../schemas/livestock.schemas");
const roleCheck_1 = require("../middlewares/roleCheck");
exports.livestockRouter = (0, express_1.Router)();
exports.livestockRouter.post('/', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(livestock_schemas_1.addLivestockSchema), livestock_controller_1.addLivestock);
exports.livestockRouter.get('/counts', errorHandler_1.authenticateJWT, livestock_controller_1.getLivestockCounts);
exports.livestockRouter.get('/', errorHandler_1.authenticateJWT, livestock_controller_1.getAllLivestock);
exports.livestockRouter.get('/:livestockId', errorHandler_1.authenticateJWT, livestock_controller_1.getLivestockById);
exports.livestockRouter.patch('/:livestockId', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(livestock_schemas_1.updateLivestockSchema), livestock_controller_1.updateLivestock);
exports.livestockRouter.delete('/:livestockId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), livestock_controller_1.deleteLivestock);
// softdelete livestock 
exports.livestockRouter.delete('/:livestockId/soft-delete', errorHandler_1.authenticateJWT, (0, validateRequest_1.validateRequest)(livestock_schemas_1.deleteLivestockSchema), livestock_controller_1.softDeleteLivestock);
// Admin-only routes
exports.livestockRouter.get('/deleted/all', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN']), livestock_controller_1.getDeletedLivestock);
exports.livestockRouter.get('/:livestockId/health-history', errorHandler_1.authenticateJWT, livestock_controller_1.getLivestockHealthHistory);
exports.livestockRouter.get('/:livestockId/activity-timeline', errorHandler_1.authenticateJWT, livestock_controller_1.getLivestockActivityTimeline);
exports.livestockRouter.patch('/:livestockId/restore', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN']), livestock_controller_1.restoreLivestock);
exports.livestockRouter.get('/vet/farm/:companyId', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['VET']), livestock_controller_1.getFarmLivestock);
