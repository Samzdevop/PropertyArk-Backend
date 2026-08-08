"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadNIN = exports.uploadAvatar = exports.deleteFile = exports.getFileUrl = exports.uploadMultipleToAzure = exports.uploadToAzure = exports.upload = exports.UPLOADS_PATH = exports.STORAGE_CONTAINERS = void 0;
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const storage_blob_1 = require("@azure/storage-blob");
const client_s3_1 = require("@aws-sdk/client-s3");
const multer_s3_1 = __importDefault(require("multer-s3"));
const uuid_1 = require("uuid");
exports.STORAGE_CONTAINERS = {
    PROPERTY_PHOTOS: 'property-photos',
    PROPERTY_VIDEOS: 'property-videos',
    PROPERTY_DOCUMENTS: 'property-documents',
    USER_AVATARS: 'user-avatars',
    NIN_DOCUMENTS: 'nin-documents'
};
exports.UPLOADS_PATH = path_1.default.join(process.cwd(), "uploads");
const storageDriver = process.env.STORAGE_DRIVER || 'local';
const storageConfig = {
    driver: storageDriver,
    uploadsFolder: path_1.default.resolve(__dirname, '..', '..', 'uploads')
};
let storage;
// S3 Client
const getS3Client = () => {
    return new client_s3_1.S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
    });
};
// Azure Client
const getAzureBlobService = () => {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error('Azure Storage connection string not found');
    }
    return storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
};
const generateSafeFileName = (originalName) => {
    const timestamp = Date.now();
    const uuid = (0, uuid_1.v4)();
    const extension = path_1.default.extname(originalName);
    const sanitizedName = path_1.default.basename(originalName, extension)
        .replace(/[^a-zA-Z0-9]/g, '-')
        .toLowerCase();
    return `${timestamp}-${uuid}-${sanitizedName}${extension}`;
};
// Configure storage based on driver
if (storageConfig.driver === 's3') {
    const s3 = getS3Client();
    storage = (0, multer_s3_1.default)({
        s3,
        bucket: process.env.AWS_BUCKET_NAME || '',
        acl: 'public-read',
        contentType: multer_s3_1.default.AUTO_CONTENT_TYPE,
        key: (_req, file, cb) => {
            const fileName = generateSafeFileName(file.originalname);
            cb(null, fileName);
        },
        metadata: (_req, file, cb) => {
            cb(null, { fieldName: file.fieldname });
        }
    });
}
else if (storageDriver === 'azure') {
    storage = multer_1.default.memoryStorage();
}
else {
    // Local storage
    storage = multer_1.default.diskStorage({
        destination: (_req, _file, cb) => {
            if (!fs_1.default.existsSync(exports.UPLOADS_PATH)) {
                fs_1.default.mkdirSync(exports.UPLOADS_PATH, { recursive: true });
            }
            cb(null, exports.UPLOADS_PATH);
        },
        filename: (_req, file, cb) => {
            cb(null, generateSafeFileName(file.originalname));
        }
    });
}
// Base upload middleware
exports.upload = (0, multer_1.default)({
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
        }
        else {
            const error = new Error(`Invalid file type "${file.mimetype}" uploaded for field "${file.fieldname}". File: ${file.originalname}`);
            error.status = 422;
            cb(error, false);
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 },
});
// Upload to Azure
const uploadToAzure = async (file, container) => {
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
    }
    catch (error) {
        console.error('Azure upload error:', error);
        throw error;
    }
};
exports.uploadToAzure = uploadToAzure;
const uploadMultipleToAzure = async (files, container) => {
    const uploadPromises = files.map(file => (0, exports.uploadToAzure)(file, container));
    return Promise.all(uploadPromises);
};
exports.uploadMultipleToAzure = uploadMultipleToAzure;
// Get file URL
const getFileUrl = (filename, container) => {
    switch (storageDriver) {
        case 'azure':
            return `${process.env.AZURE_STORAGE_URL}/${container}/${filename}`;
        case 's3':
            return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
        default:
            return `/uploads/${filename}`;
    }
};
exports.getFileUrl = getFileUrl;
// Delete file
const deleteFile = async (key, container) => {
    try {
        if (storageDriver === 'azure') {
            const blobServiceClient = getAzureBlobService();
            const containerName = container || process.env.AZURE_CONTAINER_NAME;
            const containerClient = blobServiceClient.getContainerClient(containerName);
            const blockBlobClient = containerClient.getBlockBlobClient(key);
            await blockBlobClient.deleteIfExists();
        }
        else if (storageDriver === 's3') {
            // S3 delete implementation
            const s3 = getS3Client();
            // Add delete command
        }
        else {
            const filePath = path_1.default.join(exports.UPLOADS_PATH, key);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
    }
    catch (error) {
        console.error('Error deleting file:', error);
    }
};
exports.deleteFile = deleteFile;
// Single file upload for avatar
exports.uploadAvatar = (0, multer_1.default)({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            const error = new Error(`Invalid file type for avatar. Allowed: JPEG, PNG, GIF, WEBP. Received: ${file.mimetype}`);
            error.status = 422;
            cb(error, false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});
// NIN upload (single file)
exports.uploadNIN = (0, multer_1.default)({
    storage,
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            const error = new Error(`Invalid file type for NIN. Allowed: JPEG, PNG, PDF. Received: ${file.mimetype}`);
            error.status = 422;
            cb(error, false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }
});
