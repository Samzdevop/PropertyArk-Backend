// src/scripts/keyManagement.ts
import { KeyManager } from '../utils/keyManager.util';
import prisma from '../prisma';

/**
 * Generate a new master key
 */
export const generateMasterKey = (): void => {
  const crypto = require('crypto');
  const key = crypto.randomBytes(32).toString('hex');
  console.log('\n🔐 New Master Key Generated:');
  console.log('=====================================');
  console.log(`CHAT_MASTER_KEY=${key}`);
  console.log('=====================================');
  console.log('\n⚠️  IMPORTANT:');
  console.log('   1. Copy this key to your .env file');
  console.log('   2. Store it securely (use a secrets manager in production)');
  console.log('   3. If you lose it, all encrypted data will be UNREADABLE');
  console.log('   4. NEVER commit this key to version control\n');
};

/**
 * List all encryption keys
 */
export const listKeys = async (): Promise<void> => {
  const keys = await prisma.encryptionKey.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log('\n📋 Encryption Keys:\n');
  
  if (keys.length === 0) {
    console.log('  No encryption keys found.\n');
    return;
  }

  keys.forEach(key => {
    console.log(`  KeyId: ${key.keyId}`);
    console.log(`  Algorithm: ${key.algorithm}`);
    console.log(`  Active: ${key.isActive ? '✅' : '❌'}`);
    console.log(`  Primary: ${key.isPrimary ? '⭐' : ''}`);
    console.log(`  Created: ${key.createdAt.toISOString()}`);
    console.log(`  Expires: ${key.expiresAt?.toISOString() || 'Never'}`);
    console.log('');
  });
};

/**
 * Rotate keys manually
 */
export const rotateKeys = async (): Promise<void> => {
  console.log('\n Rotating encryption keys...\n');
  await KeyManager.rotateKeys();
  console.log(' Keys rotated successfully\n');
};

/**
 * Test encryption/decryption
 */
export const testEncryption = async (): Promise<void> => {
  const { EncryptionService } = require('../services/encryption.service');
  
  const plaintext = 'Hello, this is a test message!';
  console.log('\nEncryption Test\n');
  console.log(`Original: ${plaintext}`);

  const encrypted = await EncryptionService.encrypt(plaintext);
  console.log(`\nEncrypted:`);
  console.log(`  Ciphertext: ${encrypted.ciphertext.substring(0, 50)}...`);
  console.log(`  IV: ${encrypted.iv}`);
  console.log(`  AuthTag: ${encrypted.authTag}`);
  console.log(`  KeyId: ${encrypted.keyId}`);

  const decrypted = await EncryptionService.decrypt({
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    keyId: encrypted.keyId
  });

  console.log(`\nDecrypted: ${decrypted}`);
  console.log(`\nMatch: ${plaintext === decrypted ? 'YES' : 'NO'}\n`);
};

/**
 * Show help
 */
const showHelp = (): void => {
  console.log(`
Usage: yarn key:<command>

Commands:
  generate-key    Generate a new master encryption key
  list            List all encryption keys
  rotate          Rotate encryption keys manually
  test            Test encryption/decryption

Examples:
  yarn key:generate
  yarn key:list
  yarn key:rotate
  yarn key:test
  `);
};

// CLI handler
const run = async (): Promise<void> => {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'generate-key':
        generateMasterKey();
        break;
      case 'list':
        await listKeys();
        break;
      case 'rotate':
        await rotateKeys();
        break;
      case 'test':
        await testEncryption();
        break;
      default:
        showHelp();
    }
  } catch (error: any) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

run();