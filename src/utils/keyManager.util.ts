import crypto from 'crypto';
import Logger from '../config/logger';
import prisma from '../prisma';
import { ENCRYPTION_CONFIG } from '../config/encryption.config';

interface EncryptedKeyData {
  keyId: string;
  encryptedKey: string;
  algorithm: string;
}

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
export class KeyManager {
  private static masterKey: Buffer | null = null;
  private static currentDEK: { keyId: string; key: Buffer } | null = null;
  private static keyCache: Map<string, Buffer> = new Map();

  // Initialize the master key from environment
  static initialize(): void {
    const masterKeyHex = process.env.CHAT_MASTER_KEY;
    
    if (!masterKeyHex) {
      throw new Error(
        'CHAT_MASTER_KEY is not set. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    if (masterKeyHex.length !== 64) {
      throw new Error('CHAT_MASTER_KEY must be 64 hex characters (32 bytes)');
    }

    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    Logger.info('Key manager initialized successfully');
  }

  //Get the master key
  private static getMasterKey(): Buffer {
    if (!this.masterKey) {
      this.initialize();
    }
    return this.masterKey!;
  }

  // Generate a new Data Encryption Key (DEK)
  private static generateDEK(): Buffer {
    return crypto.randomBytes(ENCRYPTION_CONFIG.KEY_LENGTH);
  }

  // Encrypt a DEK with the master key (KEK)
  private static encryptDEK(dek: Buffer): { encryptedKey: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(ENCRYPTION_CONFIG.IV_LENGTH);
    const cipher = crypto.createCipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      this.getMasterKey(),
      iv
    );

    let encrypted = cipher.update(dek);
    const final = cipher.final();
    const authTag = cipher.getAuthTag();

    return {
      encryptedKey: Buffer.concat([encrypted, final]).toString(ENCRYPTION_CONFIG.ENCODING),
      iv: iv.toString(ENCRYPTION_CONFIG.ENCODING),
      authTag: authTag.toString(ENCRYPTION_CONFIG.ENCODING)
    };
  }

  //Decrypt a DEK with the master key (KEK)
  private static decryptDEK(
    encryptedKey: string,
    iv: string,
    authTag: string
  ): Buffer {
    const decipher = crypto.createDecipheriv(
      ENCRYPTION_CONFIG.ALGORITHM,
      this.getMasterKey(),
      Buffer.from(iv, ENCRYPTION_CONFIG.ENCODING)
    );

    decipher.setAuthTag(Buffer.from(authTag, ENCRYPTION_CONFIG.ENCODING));

    const decrypted = decipher.update(
      Buffer.from(encryptedKey, ENCRYPTION_CONFIG.ENCODING)
    );
    const final = decipher.final();

    return Buffer.concat([decrypted, final]);
  }

  //Get or create the current primary DEK
  static async getCurrentDEK(): Promise<{ keyId: string; key: Buffer }> {
    if (this.currentDEK) {
      return this.currentDEK;
    }

    // Find primary active key
    const primaryKey = await prisma.encryptionKey.findFirst({
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
      const dek = this.decryptDEK(
        encryptedData.encryptedKey,
        encryptedData.iv,
        encryptedData.authTag
      );

      this.currentDEK = { keyId: primaryKey.keyId, key: dek };
      return this.currentDEK;
    }
    // Create a new primary key
    return this.createNewDEK();
  }

  //Create a new DEK and store it encrypted
  static async createNewDEK(): Promise<{ keyId: string; key: Buffer }> {
    const dek = this.generateDEK();
    const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Encrypt the DEK with master key
    const encryptedData = this.encryptDEK(dek);
    
    // Deactivate existing primary keys
    await prisma.encryptionKey.updateMany({
      where: { isPrimary: true },
      data: { isPrimary: false }
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ENCRYPTION_CONFIG.KEY_ROTATION_DAYS);

    await prisma.encryptionKey.create({
      data: {
        keyId,
        encryptedKey: JSON.stringify(encryptedData),
        algorithm: ENCRYPTION_CONFIG.ALGORITHM,
        isActive: true,
        isPrimary: true,
        expiresAt
      }
    });

    this.currentDEK = { keyId, key: dek };
    Logger.info(`New DEK created: ${keyId}`);

    return this.currentDEK;
  }

  // Get a specific DEK by keyId
  static async getDEK(keyId: string): Promise<Buffer> {
    // Check cache
    if (this.keyCache.has(keyId)) {
      return this.keyCache.get(keyId)!;
    }
    const keyRecord = await prisma.encryptionKey.findUnique({
      where: { keyId }
    });

    if (!keyRecord) {
      throw new Error(`Encryption key not found: ${keyId}`);
    }

    // Decrypt the DEK
    const encryptedData = JSON.parse(keyRecord.encryptedKey);
    const dek = this.decryptDEK(
      encryptedData.encryptedKey,
      encryptedData.iv,
      encryptedData.authTag
    );
    this.keyCache.set(keyId, dek);
    return dek;
  }

  //Rotate encryption keys
  static async rotateKeys(): Promise<void> {
    Logger.info('Starting key rotation...');

    // Create new primary key
    await this.createNewDEK();

    // Mark old keys as inactive after grace period
    const gracePeriod = new Date();
    gracePeriod.setDate(gracePeriod.getDate() - ENCRYPTION_CONFIG.KEY_GRACE_PERIOD_DAYS);

    await prisma.encryptionKey.updateMany({
      where: {
        isPrimary: false,
        createdAt: { lt: gracePeriod }
      },
      data: { isActive: false }
    });

    Logger.info('Key rotation completed');
  }

  // Clear the cache (for testing)
  static clearCache(): void {
    this.keyCache.clear();
    this.currentDEK = null;
  }
}