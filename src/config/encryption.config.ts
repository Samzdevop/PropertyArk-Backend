export const ENCRYPTION_CONFIG = {
  ALGORITHM: 'aes-256-gcm' as const,
  KEY_LENGTH: 32,      
  IV_LENGTH: 16,       
  AUTH_TAG_LENGTH: 16, 
  KEY_ROTATION_DAYS: 90,
  KEY_GRACE_PERIOD_DAYS: 30,
  ENCODING: 'hex' as const,
  CONTEXTS: {
    MESSAGE: 'chat:message:v1',
    METADATA: 'chat:metadata:v1',
    ATTACHMENT: 'chat:attachment:v1',
  },
} as const;