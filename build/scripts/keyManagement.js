"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testEncryption = exports.rotateKeys = exports.listKeys = exports.generateMasterKey = void 0;
// src/scripts/keyManagement.ts
const keyManager_util_1 = require("../utils/keyManager.util");
const prisma_1 = __importDefault(require("../prisma"));
/**
 * Generate a new master key
 */
const generateMasterKey = () => {
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
exports.generateMasterKey = generateMasterKey;
/**
 * List all encryption keys
 */
const listKeys = async () => {
    const keys = await prisma_1.default.encryptionKey.findMany({
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
exports.listKeys = listKeys;
/**
 * Rotate keys manually
 */
const rotateKeys = async () => {
    console.log('\n Rotating encryption keys...\n');
    await keyManager_util_1.KeyManager.rotateKeys();
    console.log(' Keys rotated successfully\n');
};
exports.rotateKeys = rotateKeys;
/**
 * Test encryption/decryption
 */
const testEncryption = async () => {
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
exports.testEncryption = testEncryption;
/**
 * Show help
 */
const showHelp = () => {
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
const run = async () => {
    const command = process.argv[2];
    try {
        switch (command) {
            case 'generate-key':
                (0, exports.generateMasterKey)();
                break;
            case 'list':
                await (0, exports.listKeys)();
                break;
            case 'rotate':
                await (0, exports.rotateKeys)();
                break;
            case 'test':
                await (0, exports.testEncryption)();
                break;
            default:
                showHelp();
        }
    }
    catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
    finally {
        await prisma_1.default.$disconnect();
    }
};
run();
