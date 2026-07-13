"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailRouter = void 0;
const express_1 = require("express");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const roleCheck_middleware_1 = require("../middlewares/roleCheck.middleware");
const validateRequest_middleware_1 = require("../middlewares/validateRequest.middleware");
const zod_1 = require("zod");
const email_controller_1 = require("../contollers/email.controller");
const testEmailSchema = zod_1.z.object({
    body: zod_1.z.object({
        email: zod_1.z.string().email("Invalid email format"),
    }),
});
exports.emailRouter = (0, express_1.Router)();
exports.emailRouter.post('/test', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), (0, validateRequest_middleware_1.validateRequest)(testEmailSchema), email_controller_1.testEmail);
exports.emailRouter.get('/status', errorHandler_middleware_1.authenticateJWT, (0, roleCheck_middleware_1.requireRoles)(['ADMIN']), email_controller_1.getEmailStatus);
