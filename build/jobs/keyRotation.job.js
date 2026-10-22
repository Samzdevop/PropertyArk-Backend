"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyRotationJob = void 0;
const keyManager_util_1 = require("../utils/keyManager.util");
const logger_1 = __importDefault(require("../config/logger"));
const prisma_1 = __importDefault(require("../prisma"));
const encryption_config_1 = require("../config/encryption.config");
/**
 * Key Rotation Job
 *
 * Should be run periodically (e.g., daily via cron)
 * - Rotates encryption keys every KEY_ROTATION_DAYS
 * - Cleans up expired keys
 */
class KeyRotationJob {
    //Run the key rotation job
    static async run() {
        try {
            logger_1.default.info('Running key rotation job...');
            // Check if rotation is needed
            const primaryKey = await prisma_1.default.encryptionKey.findFirst({
                where: { isPrimary: true }
            });
            if (!primaryKey) {
                logger_1.default.warn('No primary key found, creating one...');
                await keyManager_util_1.KeyManager.createNewDEK();
                return;
            }
            // Check if the primary key needs rotation
            const keyAge = Date.now() - primaryKey.createdAt.getTime();
            const rotationThreshold = encryption_config_1.ENCRYPTION_CONFIG.KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000;
            if (keyAge > rotationThreshold) {
                logger_1.default.info(`Primary key is ${Math.floor(keyAge / (24 * 60 * 60 * 1000))} days old, rotating...`);
                await keyManager_util_1.KeyManager.rotateKeys();
            }
            else {
                logger_1.default.info(`Primary key is still valid (${Math.floor(keyAge / (24 * 60 * 60 * 1000))} days old)`);
            }
            // Cleanup expired inactive keys
            const expiredKeys = await prisma_1.default.encryptionKey.deleteMany({
                where: {
                    isActive: false,
                    expiresAt: { lt: new Date() }
                }
            });
            if (expiredKeys.count > 0) {
                logger_1.default.info(`Deleted ${expiredKeys.count} expired encryption keys`);
            }
            logger_1.default.info('Key rotation job completed');
        }
        catch (error) {
            logger_1.default.error('Key rotation job failed:', error);
        }
    }
    //Start the scheduled job (runs daily)
    static start() {
        // Run once on startup (with delay)
        setTimeout(() => this.run(), 60000);
        setInterval(() => this.run(), 24 * 60 * 60 * 1000);
        logger_1.default.info('Key rotation job scheduled (daily)');
    }
}
exports.KeyRotationJob = KeyRotationJob;
