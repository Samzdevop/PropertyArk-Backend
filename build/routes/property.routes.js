"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyRouter = void 0;
const express_1 = require("express");
const upload_1 = require("../config/upload");
const property_controller_1 = require("../contollers/property.controller");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const property_schemas_1 = require("../schemas/property.schemas");
const trackView_middleware_1 = require("../middlewares/trackView.middleware");
exports.propertyRouter = (0, express_1.Router)();
exports.propertyRouter.get('/available', property_controller_1.getAvailableProperties);
exports.propertyRouter.get('/public/:id', trackView_middleware_1.trackPropertyView, property_controller_1.getPublicPropertyById);
exports.propertyRouter.get('/', errorHandler_middleware_1.authenticateJWT, property_controller_1.getAllProperties);
exports.propertyRouter.get('/my-properties', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), (0, validateRequest_middleware_1.validateRequest)(property_schemas_1.myPropertiesQuerySchema), property_controller_1.getMyProperties);
exports.propertyRouter.get('/:id', errorHandler_middleware_1.authenticateJWT, trackView_middleware_1.trackPropertyView, property_controller_1.getPropertyById);
exports.propertyRouter.post('/', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), upload_1.upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
]), (0, validateRequest_middleware_1.validateRequest)(property_schemas_1.createPropertySchema), property_controller_1.createProperty);
exports.propertyRouter.patch('/:id', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), upload_1.upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
]), (0, validateRequest_middleware_1.validateRequest)(property_schemas_1.updatePropertySchema), property_controller_1.updateProperty);
exports.propertyRouter.patch('/:id/review', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(property_schemas_1.reviewPropertySchema), property_controller_1.reviewProperty);
exports.propertyRouter.delete('/:id', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), property_controller_1.deleteProperty);
exports.propertyRouter.post('/:id/media', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), upload_1.upload.fields([
    { name: 'photos', maxCount: 10 },
    { name: 'videos', maxCount: 5 },
    { name: 'documents', maxCount: 10 }
]), property_controller_1.uploadPropertyMedia);
exports.propertyRouter.get('/:id/media', errorHandler_middleware_1.authenticateJWT, property_controller_1.getPropertyMedia);
exports.propertyRouter.get('/:id/media/stats', errorHandler_middleware_1.authenticateJWT, property_controller_1.getPropertyMediaStats);
exports.propertyRouter.get('/media/:mediaId', errorHandler_middleware_1.authenticateJWT, property_controller_1.getMediaById);
exports.propertyRouter.patch('/media/:mediaId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), (0, validateRequest_middleware_1.validateRequest)(property_schemas_1.updateMediaSchema), property_controller_1.updateMedia);
exports.propertyRouter.delete('/media/:mediaId', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), property_controller_1.deleteMedia);
exports.propertyRouter.delete('/:id/media/bulk', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), (0, validateRequest_middleware_1.validateRequest)(property_schemas_1.bulkDeleteMediaSchema), property_controller_1.bulkDeleteMedia);
exports.propertyRouter.patch('/media/:mediaId/primary', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN', 'VENDOR', 'STAFF']), property_controller_1.setPrimaryMedia);
