import crypto from 'crypto';
import { KeyManager } from '../utils/keyManager.util';
import { ENCRYPTION_CONFIG } from '../config/encryption.config';
import Logger from '../config/logger';

export interface EncryptedPayload {
  ciphertext: string;   
  iv: string;           // Initialization vector
  authTag: string;      // GCM authentication tag
  keyId: string;        // Which DEK was used
}

export interface DecryptionInput {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyId: string;
}

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
export class EncryptionService {

  //Encrypt a message with context binding
  static async encrypt(
    plaintext: string,
    context: string = ENCRYPTION_CONFIG.CONTEXTS.MESSAGE
  ): Promise<EncryptedPayload> {
    try {
      // Get current DEK
      const { keyId, key } = await KeyManager.getCurrentDEK();

      // Generate unique IV for this message
      const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(
        ENCRYPTION_CONFIG.ALGORITHM,
        key,
        iv
      );

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
        ciphertext: encrypted.toString(ENCRYPTION_CONFIG.ENCODING),
        iv: iv.toString(ENCRYPTION_CONFIG.ENCODING),
        authTag: authTag.toString(ENCRYPTION_CONFIG.ENCODING),
        keyId
      };
    } catch (error: any) {
      Logger.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a message
   */
  static async decrypt(
    input: DecryptionInput,
    context: string = ENCRYPTION_CONFIG.CONTEXTS.MESSAGE
  ): Promise<string> {
    try {
      // Get the DEK used for this message
      const key = await KeyManager.getDEK(input.keyId);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        ENCRYPTION_CONFIG.ALGORITHM,
        key,
        Buffer.from(input.iv, ENCRYPTION_CONFIG.ENCODING)
      );

      // Set authentication tag
      decipher.setAuthTag(Buffer.from(input.authTag, ENCRYPTION_CONFIG.ENCODING));

      // ✅ Set AAD for context verification
      decipher.setAAD(Buffer.from(context, 'utf8'));

      // Decrypt
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(input.ciphertext, ENCRYPTION_CONFIG.ENCODING)),
        decipher.final()
      ]);

      return decrypted.toString('utf8');
    } catch (error: any) {
      Logger.error('Decryption failed:', error);
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Generate a searchable hash for exact match (for searching without decryption)
   */
  static generateSearchHash(content: string): string {
    const masterKey = process.env.CHAT_MASTER_KEY!;
    return crypto
      .createHmac('sha256', masterKey)
      .update(content.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Encrypt JSON metadata
   */
  static async encryptMetadata(metadata: any): Promise<EncryptedPayload> {
    const jsonString = JSON.stringify(metadata);
    return this.encrypt(jsonString, ENCRYPTION_CONFIG.CONTEXTS.METADATA);
  }

  /**
   * Decrypt JSON metadata
   */
  static async decryptMetadata(input: DecryptionInput): Promise<any> {
    const jsonString = await this.decrypt(input, ENCRYPTION_CONFIG.CONTEXTS.METADATA);
    return JSON.parse(jsonString);
  }

  //Encrypt a file/buffer (for attachments)
  static async encryptBuffer(buffer: Buffer): Promise<{
    encryptedData: Buffer;
    iv: string;
    authTag: string;
    keyId: string;
  }> {
    const { keyId, key } = await KeyManager.getCurrentDEK();
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);

    const cipher = crypto.createCipheriv(ENCRYPTION_CONFIG.ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from(ENCRYPTION_CONFIG.CONTEXTS.ATTACHMENT, 'utf8'));

    const encrypted = Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);

    return {
      encryptedData: encrypted,
      iv: iv.toString(ENCRYPTION_CONFIG.ENCODING),
      authTag: cipher.getAuthTag().toString(ENCRYPTION_CONFIG.ENCODING),
      keyId
    };
  }

  //Decrypt a file/buffer
  static async decryptBuffer(
    encryptedData: Buffer,
    iv: string,
    authTag: string,
    keyId: string
  ): Promise<Buffer> {
    const key = await KeyManager.getDEK(keyId);

    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      key,
      Buffer.from(iv, ENCRYPTION_CONFIG.ENCODING)
    );

    decipher.setAuthTag(Buffer.from(authTag, ENCRYPTION_CONFIG.ENCODING));
    decipher.setAAD(Buffer.from(ENCRYPTION_CONFIG.CONTEXTS.ATTACHMENT, 'utf8'));

    return Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);
  }
}