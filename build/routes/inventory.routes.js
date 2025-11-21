"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryRouter = void 0;
const express_1 = require("express");
const inventory_controller_1 = require("../contollers/inventory.controller");
const errorHandler_1 = require("../middlewares/errorHandler");
const validateRequest_1 = require("../middlewares/validateRequest");
const inventory_schemas_1 = require("../schemas/inventory.schemas");
const roleCheck_1 = require("../middlewares/roleCheck");
const upload_1 = require("../config/upload");
exports.inventoryRouter = (0, express_1.Router)();
// Create inventory records (NEW, ITEM, USE)
exports.inventoryRouter.post('/records', errorHandler_1.authenticateJWT, (0, roleCheck_1.requireRoles)(['ADMIN', 'FARM_KEEPER']), upload_1.upload.array('media'), 
// (req, res, next) => {
//   console.log('=== INCOMING REQUEST DATA ===');
//   console.log('Headers:', req.headers);
//   console.log('Body:', req.body);
//   console.log('Files:', (req.files as Express.Multer.File[] | undefined)?.map(f => ({
//     originalname: f.originalname,
//     mimetype: f.mimetype,
//     size: f.size
//   })));
//   console.log('============================');
//   next();
// },
(0, validateRequest_1.validateRequest)(inventory_schemas_1.createInventoryRecordSchema), inventory_controller_1.createInventoryRecord);
// Get all inventory records (NEW/ITEM/USE)
exports.inventoryRouter.get('/records', errorHandler_1.authenticateJWT, inventory_controller_1.getInventoryRecords);
// Get specific inventory record
exports.inventoryRouter.get('/records/:recordId', errorHandler_1.authenticateJWT, inventory_controller_1.getInventoryRecord);
// Get all inventory items
exports.inventoryRouter.get('/items', errorHandler_1.authenticateJWT, inventory_controller_1.getInventoryItems);
// Get specific inventory item with its records
exports.inventoryRouter.get('/items/:inventoryId', errorHandler_1.authenticateJWT, inventory_controller_1.getInventoryItem);
