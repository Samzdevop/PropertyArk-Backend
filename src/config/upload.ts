import multer, { StorageEngine } from 'multer';
import fs from 'fs';
import path from 'path';
import { BlobServiceClient } from '@azure/storage-blob';
import { S3Client } from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';
import { v4 as uuidv4 } from 'uuid';

export const STORAGE_CONTAINERS = {
  PROPERTY_PHOTOS: 'property-photos',
  PROPERTY_VIDEOS: 'property-videos',
  PROPERTY_DOCUMENTS: 'property-documents',
  USER_AVATARS: 'user-avatars',
  NIN_DOCUMENTS: 'nin-documents'
};

export const UPLOADS_PATH = path.join(process.cwd(), "uploads");

type StorageDriver = 'local' | 's3' | 'azure';

const storageDriver = (process.env.STORAGE_DRIVER as StorageDriver) || 'local';

let storage: StorageEngine;

// S3 Client
const getS3Client = () => {
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
  });
};

// Azure Client
const getAzureBlobService = () => {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Azure Storage connection string not found');
  }
  return BlobServiceClient.fromConnectionString(connectionString);
};

const generateSafeFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const uuid = uuidv4();
  const extension = path.extname(originalName);
  const sanitizedName = path.basename(originalName, extension)
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase();
  return `${timestamp}-${uuid}-${sanitizedName}${extension}`;
};

// Configure storage based on driver
if (storageDriver === 's3') {
  const s3 = getS3Client();
  storage = multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME || '',
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_req, file, cb) => {
      const fileName = generateSafeFileName(file.originalname);
      cb(null, fileName);
    },
    metadata: (_req, file, cb) => {
      cb(null, { fieldName: file.fieldname });
    }
  });
} else if (storageDriver === 'azure') {
  storage = multer.memoryStorage();
} else {
  // Local storage
  storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(UPLOADS_PATH)) {
        fs.mkdirSync(UPLOADS_PATH, { recursive: true });
      }
      cb(null, UPLOADS_PATH);
    },
    filename: (_req, file, cb) => {
      cb(null, generateSafeFileName(file.originalname));
    }
  });
}

// Base upload middleware
export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'video/mp4', 'video/mpeg', 'video/quicktime'
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error: any = new Error(
        `Invalid file type "${file.mimetype}" uploaded for field "${file.fieldname}". File: ${file.originalname}`
      );
      error.status = 422;
      cb(error, false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Upload to Azure
export const uploadToAzure = async (file: Express.Multer.File, container?: string): Promise<string> => {
  try {
    const blobServiceClient = getAzureBlobService();
    const containerName = container || process.env.AZURE_CONTAINER_NAME || 'uploads';
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: 'blob' });
    const blobName = generateSafeFileName(file.originalname);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype }
    });
    return blockBlobClient.url;
  } catch (error) {
    console.error('Azure upload error:', error);
    throw error;
  }
};

export const uploadMultipleToAzure = async (files: Express.Multer.File[], container?: string): Promise<string[]> => {
  const uploadPromises = files.map(file => uploadToAzure(file, container));
  return Promise.all(uploadPromises);
};

// Get file URL
export const getFileUrl = (filename: string, container?: string): string => {
  switch (storageDriver) {
    case 'azure':
      return `${process.env.AZURE_STORAGE_URL}/${container}/${filename}`;
    case 's3':
      return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
    default:
      return `/uploads/${filename}`;
  }
};

// Delete file
export const deleteFile = async (key: string, container?: string) => {
  try {
    if (storageDriver === 'azure') {
      const blobServiceClient = getAzureBlobService();
      const containerName = container || process.env.AZURE_CONTAINER_NAME!;
      const containerClient = blobServiceClient.getContainerClient(containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(key);
      await blockBlobClient.deleteIfExists();
    } else if (storageDriver === 's3') {
      // S3 delete implementation
      const s3 = getS3Client();
      // Add delete command
    } else {
      const filePath = path.join(UPLOADS_PATH, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error('Error deleting file:', error);
  }
};

// Single file upload for avatar
export const uploadAvatar = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error: any = new Error(
        `Invalid file type for avatar. Allowed: JPEG, PNG, GIF, WEBP. Received: ${file.mimetype}`
      );
      error.status = 422;
      cb(error, false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// NIN upload (single file)
export const uploadNIN = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const error: any = new Error(
        `Invalid file type for NIN. Allowed: JPEG, PNG, PDF. Received: ${file.mimetype}`
      );
      error.status = 422;
      cb(error, false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});