"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorRouter = void 0;
// routes/vendorDashboard.routes.ts
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const vendor_controller_1 = require("../contollers/vendor.controller");
exports.vendorRouter = (0, express_1.Router)();
exports.vendorRouter.get('/stats', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['VENDOR', 'ADMIN']), vendor_controller_1.getVendorDashboardStats);
