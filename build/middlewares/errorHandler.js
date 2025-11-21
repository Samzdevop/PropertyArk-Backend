"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.authenticateJWT = void 0;
const zod_1 = require("zod"); // For Zod validation errors
const client_1 = require("@prisma/client"); // For Prisma errors
const logger_1 = __importDefault(require("../config/logger"));
const passport_1 = __importDefault(require("passport"));
const errorTypes_1 = require("../errors/errorTypes");
const UnauthorizedError_1 = require("../errors/UnauthorizedError");
const BadRequestError_1 = require("../errors/BadRequestError");
const ForbiddenError_1 = require("../errors/ForbiddenError");
const NotFoundError_1 = require("../errors/NotFoundError");
// export const authenticateJWT = passport.authenticate('jwt', { session: false });
const authenticateJWT = (req, res, next) => {
    passport_1.default.authenticate('jwt', { session: false }, (err, user, info) => {
        if (err) {
            return res.status(500).json({
                success: false,
                error: 'Internal Server Error',
                details: err.message,
            });
        }
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                details: info?.message || 'Invalid or missing token',
            });
        }
        req.user = user; // Attach the user to the request object for downstream access
        return next();
    })(req, res, next);
};
exports.authenticateJWT = authenticateJWT;
// Enhanced Error Handler
const errorHandler = (err, _req, res, _next) => {
    // Default error response
    let statusCode = 500;
    let errorMessage = 'Internal Server Error';
    let details = undefined;
    // Handle Prisma errors
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        statusCode = 400; // Bad Request
        errorMessage = `Prisma error: ${err.message}`;
        if (err.code === 'P2002') {
            statusCode = errorTypes_1.ERROR_CODES.CONFLICT;
            errorMessage = 'Unique constraint failed. Duplicate entry.';
            const field = err.meta?.target || 'field';
            details = `A record with this ${field} already exists`;
        }
    }
    else if (err instanceof client_1.Prisma.PrismaClientValidationError) {
        statusCode = 422; // Unprocessable Entity
        errorMessage = `Database validation error: ${err.message}`;
    }
    // Handle Zod validation errors
    else if (err instanceof zod_1.ZodError) {
        statusCode = 422; // Unprocessable Entity
        errorMessage = 'Validation failed';
        const issues = err.errors.map((issue) => ({
            field: issue.path.join('.').replace(/^body\./, ''),
            message: issue.message.replace(/^\w/, (c) => c.toUpperCase()),
        }));
        const errorMessages = issues.map((err) => `${err.field}: ${err.message}`);
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            message: 'Please correct the following errors:',
            issues,
            errors: errorMessages,
        });
        return;
    }
    // Handle custom application errors
    else if (err instanceof BadRequestError_1.BadRequestError) {
        statusCode = 400; // Bad Request
        errorMessage = err.message || 'Bad Request';
    }
    else if (err instanceof UnauthorizedError_1.UnauthorizedError) {
        statusCode = 401; // Unauthorized
        errorMessage = err.message || 'Authentication credentials are invalid.';
    }
    else if (err instanceof ForbiddenError_1.ForbiddenError) {
        statusCode = 403; // Forbidden
        errorMessage =
            err.message || 'You do not have permission to access this resource.';
    }
    else if (err instanceof NotFoundError_1.NotFoundError) {
        statusCode = 404; // Not Found
        errorMessage = err.message || 'Resource not found.';
    }
    // Handle general errors with a status property
    else if (err.status) {
        statusCode = err.status;
        errorMessage = err.message || 'An error occurred.';
    }
    logger_1.default.error(errorMessage, err);
    // Final response
    res.status(statusCode).json({
        success: false,
        error: errorMessage,
    });
};
exports.errorHandler = errorHandler;
