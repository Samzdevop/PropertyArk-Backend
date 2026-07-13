"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const notFoundHandler = (req, res, _next) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        details: `The requested URL ${req.originalUrl} was not found on this server.`,
    });
};
exports.notFoundHandler = notFoundHandler;
