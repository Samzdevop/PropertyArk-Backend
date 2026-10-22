"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const keyManager_util_1 = require("../utils/keyManager.util");
const encryption_config_1 = require("../config/encryption.config");
const logger_1 = __importDefault(require("../config/logger"));
/**
 * Message Encryption Service
 *
 * Uses AES-256-GCM with per-message Data Encryption Keys (DEK).
 * Each message has its own DEK, which is encrypted with the master Key Encryption Key (KEK).
 *
 * Security features:
 * - Authenticated encryption (GCM mode prevents tampering)
 * - Unique IV per encryption (prevents replay attacks)
 * - Per-message DEK (limits damage if one key is compromised)
 * - Context binding (prevents cross-context attacks)
 * - Key rotation support
 */
class EncryptionService {
    //Encrypt a message with context binding
    static async encrypt(plaintext, context = encryption_config_1.ENCRYPTION_CONFIG.CONTEXTS.MESSAGE) {
        try {
            // Get current DEK
            const { keyId, key } = await keyManager_util_1.KeyManager.getCurrentDEK();
            // Generate unique IV for this message
            const iv = crypto_1.default.randomBytes(encryption_config_1.ENCRYPTION_CONFIG.IV_LENGTH);
            // Create cipher
            const cipher = crypto_1.default.createCipheriv(encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM, key, iv);
            // ✅ Add authentication data (context binding)
            // This prevents an attacker from moving ciphertext between different contexts
            cipher.setAAD(Buffer.from(context, 'utf8'));
            // Encrypt
            const encrypted = Buffer.concat([
                cipher.update(plaintext, 'utf8'),
                cipher.final()
            ]);
            // Get authentication tag
            const authTag = cipher.getAuthTag();
            return {
                ciphertext: encrypted.toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
                iv: iv.toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
                authTag: authTag.toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
                keyId
            };
        }
        catch (error) {
            logger_1.default.error('Encryption failed:', error);
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }
    /**
     * Decrypt a message
     */
    static async decrypt(input, context = encryption_config_1.ENCRYPTION_CONFIG.CONTEXTS.MESSAGE) {
        try {
            // Get the DEK used for this message
            const key = await keyManager_util_1.KeyManager.getDEK(input.keyId);
            // Create decipher
            const decipher = crypto_1.default.createDecipheriv(encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM, key, Buffer.from(input.iv, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
            // Set authentication tag
            decipher.setAuthTag(Buffer.from(input.authTag, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
            // ✅ Set AAD for context verification
            decipher.setAAD(Buffer.from(context, 'utf8'));
            // Decrypt
            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(input.ciphertext, encryption_config_1.ENCRYPTION_CONFIG.ENCODING)),
                decipher.final()
            ]);
            return decrypted.toString('utf8');
        }
        catch (error) {
            logger_1.default.error('Decryption failed:', error);
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }
    /**
     * Generate a searchable hash for exact match (for searching without decryption)
     */
    static generateSearchHash(content) {
        const masterKey = process.env.CHAT_MASTER_KEY;
        return crypto_1.default
            .createHmac('sha256', masterKey)
            .update(content.toLowerCase().trim())
            .digest('hex');
    }
    /**
     * Encrypt JSON metadata
     */
    static async encryptMetadata(metadata) {
        const jsonString = JSON.stringify(metadata);
        return this.encrypt(jsonString, encryption_config_1.ENCRYPTION_CONFIG.CONTEXTS.METADATA);
    }
    /**
     * Decrypt JSON metadata
     */
    static async decryptMetadata(input) {
        const jsonString = await this.decrypt(input, encryption_config_1.ENCRYPTION_CONFIG.CONTEXTS.METADATA);
        return JSON.parse(jsonString);
    }
    //Encrypt a file/buffer (for attachments)
    static async encryptBuffer(buffer) {
        const { keyId, key } = await keyManager_util_1.KeyManager.getCurrentDEK();
        const iv = crypto_1.default.randomBytes(encryption_config_1.ENCRYPTION_CONFIG.IV_LENGTH);
        const cipher = crypto_1.default.createCipheriv(encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM, key, iv);
        cipher.setAAD(Buffer.from(encryption_config_1.ENCRYPTION_CONFIG.CONTEXTS.ATTACHMENT, 'utf8'));
        const encrypted = Buffer.concat([
            cipher.update(buffer),
            cipher.final()
        ]);
        return {
            encryptedData: encrypted,
            iv: iv.toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
            authTag: cipher.getAuthTag().toString(encryption_config_1.ENCRYPTION_CONFIG.ENCODING),
            keyId
        };
    }
    //Decrypt a file/buffer
    static async decryptBuffer(encryptedData, iv, authTag, keyId) {
        const key = await keyManager_util_1.KeyManager.getDEK(keyId);
        const decipher = crypto_1.default.createDecipheriv(encryption_config_1.ENCRYPTION_CONFIG.ALGORITHM, key, Buffer.from(iv, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
        decipher.setAuthTag(Buffer.from(authTag, encryption_config_1.ENCRYPTION_CONFIG.ENCODING));
        decipher.setAAD(Buffer.from(encryption_config_1.ENCRYPTION_CONFIG.CONTEXTS.ATTACHMENT, 'utf8'));
        return Buffer.concat([
            decipher.update(encryptedData),
            decipher.final()
        ]);
    }
}
exports.EncryptionService = EncryptionService;
