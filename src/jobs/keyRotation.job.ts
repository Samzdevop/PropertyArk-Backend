import { KeyManager } from '../utils/keyManager.util';
import Logger from '../config/logger';
import prisma from '../prisma';
import { ENCRYPTION_CONFIG } from '../config/encryption.config';

/**
 * Key Rotation Job
 * 
 * Should be run periodically (e.g., daily via cron)
 * - Rotates encryption keys every KEY_ROTATION_DAYS
 * - Cleans up expired keys
 */
export class KeyRotationJob {

  //Run the key rotation job
  static async run(): Promise<void> {
    try {
      Logger.info('Running key rotation job...');

      // Check if rotation is needed
      const primaryKey = await prisma.encryptionKey.findFirst({
        where: { isPrimary: true }
      });

      if (!primaryKey) {
        Logger.warn('No primary key found, creating one...');
        await KeyManager.createNewDEK();
        return;
      }

      // Check if the primary key needs rotation
      const keyAge = Date.now() - primaryKey.createdAt.getTime();
      const rotationThreshold = ENCRYPTION_CONFIG.KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000;

      if (keyAge > rotationThreshold) {
        Logger.info(`Primary key is ${Math.floor(keyAge / (24 * 60 * 60 * 1000))} days old, rotating...`);
        await KeyManager.rotateKeys();
      } else {
        Logger.info(`Primary key is still valid (${Math.floor(keyAge / (24 * 60 * 60 * 1000))} days old)`);
      }

      // Cleanup expired inactive keys
      const expiredKeys = await prisma.encryptionKey.deleteMany({
        where: {
          isActive: false,
          expiresAt: { lt: new Date() }
        }
      });

      if (expiredKeys.count > 0) {
        Logger.info(`Deleted ${expiredKeys.count} expired encryption keys`);
      }

      Logger.info('Key rotation job completed');
    } catch (error) {
      Logger.error('Key rotation job failed:', error);
    }
  }

  //Start the scheduled job (runs daily)
  static start(): void {
    // Run once on startup (with delay)
    setTimeout(() => this.run(), 60000); 
    setInterval(() => this.run(), 24 * 60 * 60 * 1000);
    Logger.info('Key rotation job scheduled (daily)');
  }
}