"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const app_1 = require("./app");
const logger_1 = __importDefault(require("./config/logger"));
const socket_service_1 = require("./services/socket.service");
const keyManager_util_1 = require("./utils/keyManager.util");
const keyRotation_job_1 = require("./jobs/keyRotation.job");
const pdf_service_1 = require("./services/pdf.service");
const PORT = config_1.config.PORT;
let server = null;
const gracefulShutdown = async (signal) => {
    logger_1.default.info(`${signal} received. Starting graceful shutdown...`);
    const forceShutdownTimeout = setTimeout(() => {
        logger_1.default.error('Graceful shutdown timeout. Forcefully terminating...');
        process.exit(1);
    }, 30000);
    try {
        // Close HTTP server
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err)
                        reject(err);
                    else {
                        logger_1.default.info('HTTP server closed');
                        resolve();
                    }
                });
            });
        }
        // Close Socket.IO
        try {
            socket_service_1.SocketService.getIO().close();
            logger_1.default.info('Socket.IO server closed');
        }
        catch (error) {
            // Socket might not be initialized
        }
        // Close PDF browser
        try {
            await pdf_service_1.pdfGenerator.closeBrowser();
            logger_1.default.info('PDF browser closed');
        }
        catch (error) {
            // PDF browser might not be initialized
        }
        clearTimeout(forceShutdownTimeout);
        logger_1.default.info('Graceful shutdown completed');
        process.exit(0);
    }
    catch (error) {
        logger_1.default.error('Error during graceful shutdown:', error);
        clearTimeout(forceShutdownTimeout);
        process.exit(1);
    }
};
try {
    keyManager_util_1.KeyManager.initialize();
    logger_1.default.info('Encryption initialized successfully');
}
catch (error) {
    logger_1.default.error('Failed to initialize encryption:', error.message);
    process.exit(1);
}
server = app_1.app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    keyRotation_job_1.KeyRotationJob.start();
});
socket_service_1.SocketService.initialize(server);
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    logger_1.default.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logger_1.default.error('Unhandled Rejection:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});
// import { app } from './app';
// import { config } from './config';
// let server: any = null;
// const PORT = config.PORT;
// server = app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
