"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("./config/logger"));
const auth_routes_1 = require("./routes/auth.routes");
const notFoundRoute_middleware_1 = require("./middlewares/notFoundRoute.middleware");
const errorHandler_middleware_1 = require("./middlewares/errorHandler.middleware");
const users_routes_1 = require("./routes/users.routes");
const passport_1 = __importDefault(require("passport"));
require("./config/passport");
// import path from 'path';
const upload_1 = require("./config/upload");
const property_routes_1 = require("./routes/property.routes");
const nin_routes_1 = require("./routes/nin.routes");
const activity_routes_1 = require("./routes/activity.routes");
const email_routes_1 = require("./routes/email.routes");
const favorite_routes_1 = require("./routes/favorite.routes");
const inquiry_routes_1 = require("./routes/inquiry.routes");
const vendor_routes_1 = require("./routes/vendor.routes");
const viewStats_routes_1 = require("./routes/viewStats.routes");
exports.app = (0, express_1.default)();
exports.app.use(passport_1.default.initialize());
exports.app.use((0, helmet_1.default)());
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
];
exports.app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
exports.app.use(express_1.default.json());
(0, morgan_1.default)('tiny');
const stream = {
    write: (text) => {
        logger_1.default.info(text);
    },
};
exports.app.use((0, morgan_1.default)(':method :url :status :response-time ms - :res[content-length]', {
    stream,
}));
exports.app.get('/', (_req, res) => {
    res.json({ success: true, message: 'PropertyArk API is working just fine!' });
});
exports.app.use("/uploads", express_1.default.static(upload_1.UPLOADS_PATH));
exports.app.use('/api/v1/auth', auth_routes_1.authRouter);
exports.app.use('/api/v1/users', users_routes_1.usersRouter);
exports.app.use('/api/v1/properties', property_routes_1.propertyRouter);
exports.app.use('/api/v1/nin', nin_routes_1.ninRouter);
exports.app.use('/api/v1/activity', activity_routes_1.activityRouter);
exports.app.use('/api/v1/email', email_routes_1.emailRouter);
exports.app.use('/api/v1/favorites', favorite_routes_1.favoriteRouter);
exports.app.use('/api/v1/inquiries', inquiry_routes_1.inquiryRouter);
exports.app.use('/api/v1/vendor', vendor_routes_1.vendorRouter);
exports.app.use('/api/v1/view-stats', viewStats_routes_1.viewStatsRouter);
exports.app.use(notFoundRoute_middleware_1.notFoundHandler);
exports.app.use(errorHandler_middleware_1.errorHandler);
