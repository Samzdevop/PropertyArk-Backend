"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyManager = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../config/logger"));
const prisma_1 = __importDefault(require("../prisma"));
const encryption_config_1 = require("../config/encryption.config");
/**
 * Master Key Manager
 *
 * Handles the master encryption key (KEK - Key Encryption Key) and
 * manages Data Encryption Keys (DEKs) stored in the database.
 *
 * Architecture:
 * - Master Key (KEK): Stored in environment/secrets manager
 * - Data Encryption Keys (DEKs): Stored encrypted in database
 * - Each message uses a unique DEK, encrypted with the KEK
 */
class KeyManager {
    static masterKey = null;
    static currentDEK = null;
    static keyCache = new Map();
    // Initialize the master key from environment
    static initialize() {
        const masterKeyHex = process.env.CHAT_MASTER_KEY;
        if (!masterKeyHex) {
            throw new Error('CHAT_MASTER_KEY is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
        }
        if (masterKeyHex.length !== 64) {
            throw new Error('CHAT_MASTER_KEY must be 64 hex characters (32 bytes)');
        }
        this.masterKey = Buffer.from(masterKeyHex, 'hex');
        logger_1.default.info('Key manager initialized successfully');
    }
    //Get the master key
    static getMasterKey() {
        if (!this.masterKey) {
            this.initialize();
        }
        return this.masterKey;
    }
    // Generate a new Data Encryption Key (DEK)
    static generateDEK() {
        return crypto_1.default.randomBytes(encryption_config_1.ENCRYPTION_CONFIG.KEY_LENGTH);
    }
    // Encrypt a DEK with the master key (KEK)
    static encryptDEK(dek) {
        const iv = crypto_1.default.randomBytes(encryption_config_1.ENCRYPTION_CONFIG.IV_LENGTH);
        const cipher = crypto_1.default.createCipheriv(encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM, this.getMasterKey(), iv);
        let encrypted = cipher.update(dek);
        const final = cipher.final();
        const authTag = cipher.getAuthTag();
        return {
            encryptedKey: Buffer.concat([encrypted, final]).toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
            iv: iv.toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
            authTag: authTag.toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING)
        };
    }
    //Decrypt a DEK with the master key (KEK)
    static decryptDEK(encryptedKey, iv, authTag) {
        const decipher = crypto_1.default.createDecipheriv(encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM, this.getMasterKey(), Buffer.from(iv, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
        decipher.setAuthTag(Buffer.from(authTag, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
        const decrypted = decipher.update(Buffer.from(encryptedKey, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
        const final = decipher.final();
        return Buffer.concat([decrypted, final]);
    }
    //Get or create the current primary DEK
    static async getCurrentDEK() {
        if (this.currentDEK) {
            return this.currentDEK;
        }
        // Find primary active key
        const primaryKey = await prisma_1.default.encryptionKey.findFirst({
            where: {
                isActive: true,
                isPrimary: true,
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } }
                ]
            }
        });
        if (primaryKey) {
            // Decrypt the DEK
            const encryptedData = JSON.parse(primaryKey.encryptedKey);
            const dek = this.decryptDEK(encryptedData.encryptedKey, encryptedData.iv, encryptedData.authTag);
            this.currentDEK = { keyId: primaryKey.keyId, key: dek };
            return this.currentDEK;
        }
        // Create a new primary key
        return this.createNewDEK();
    }
    //Create a new DEK and store it encrypted
    static async createNewDEK() {
        const dek = this.generateDEK();
        const keyId = `key_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
        // Encrypt the DEK with master key
        const encryptedData = this.encryptDEK(dek);
        // Deactivate existing primary keys
        await prisma_1.default.encryptionKey.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + encryption_config_1.ENCRYPTION_CONFIG.KEY_ROTATION_DAYS);
        await prisma_1.default.encryptionKey.create({
            data: {
                keyId,
                encryptedKey: JSON.stringify(encryptedData),
                algorithm: encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM,
                isActive: true,
                isPrimary: true,
                expiresAt
            }
        });
        this.currentDEK = { keyId, key: dek };
        logger_1.default.info(`New DEK created: ${keyId}`);
        return this.currentDEK;
    }
    // Get a specific DEK by keyId
    static async getDEK(keyId) {
        // Check cache
        if (this.keyCache.has(keyId)) {
            return this.keyCache.get(keyId);
        }
        const keyRecord = await prisma_1.default.encryptionKey.findUnique({
            where: { keyId }
        });
        if (!keyRecord) {
            throw new Error(`Encryption key not found: ${keyId}`);
        }
        // Decrypt the DEK
        const encryptedData = JSON.parse(keyRecord.encryptedKey);
        const dek = this.decryptDEK(encryptedData.encryptedKey, encryptedData.iv, encryptedData.authTag);
        this.keyCache.set(keyId, dek);
        return dek;
    }
    //Rotate encryption keys
    static async rotateKeys() {
        logger_1.default.info('Starting key rotation...');
        // Create new primary key
        await this.createNewDEK();
        // Mark old keys as inactive after grace period
        const gracePeriod = new Date();
        gracePeriod.setDate(gracePeriod.getDate() - encryption_config_1.ENCRYPTION_CONFIG.KEY_GRACE_PERIOD_DAYS);
        await prisma_1.default.encryptionKey.updateMany({
            where: {
                isPrimary: false,
                createdAt: { lt: gracePeriod }
            },
            data: { isActive: false }
        });
        logger_1.default.info('Key rotation completed');
    }
    // Clear the cache (for testing)
    static clearCache() {
        this.keyCache.clear();
        this.currentDEK = null;
    }
}
exports.KeyManager = KeyManager;
