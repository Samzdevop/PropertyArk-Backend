"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFile = exports.getFileUrl = exports.upload = exports.UPLOADS_PATH = void 0;
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_s3_1 = require("@aws-sdk/client-s3");
const multer_s3_1 = __importDefault(require("multer-s3"));
exports.UPLOADS_PATH = path_1.default.join(process.cwd(), "uploads");
// Determine storage driver from env
const storageDriver = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
const storageConfig = {
    driver: storageDriver,
    uploadsFolder: path_1.default.resolve(__dirname, '..', '..', 'uploads')
};
let storage;
if (storageConfig.driver === 's3') {
    const s3 = new client_s3_1.S3Client({
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
    });
    storage = (0, multer_s3_1.default)({
        s3,
        bucket: process.env.AWS_BUCKET_NAME || '',
        acl: 'public-read',
        contentType: multer_s3_1.default.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            const fileName = `${Date.now()}-${file.originalname}`;
            cb(null, fileName);
        }
    });
}
else {
    // storage = multer.diskStorage({
    //   destination: (req, file, cb) => {
    //     if (!fs.existsSync(storageConfig.uploadsFolder)) {
    //       fs.mkdirSync(storageConfig.uploadsFolder, { recursive: true });
    //     }
    //     cb(null, storageConfig.uploadsFolder);
    //   },
    //   filename: (req, file, cb) => {
    //     cb(null, `${Date.now()}-${file.originalname}`);
    //   }
    // });
    storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => {
            if (!fs_1.default.existsSync(exports.UPLOADS_PATH)) {
                fs_1.default.mkdirSync(exports.UPLOADS_PATH, { recursive: true });
            }
            cb(null, exports.UPLOADS_PATH);
        },
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    });
}
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
});
const getFileUrl = (filename) => storageConfig.driver === 's3'
    ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`
    : `/uploads/${filename}`;
exports.getFileUrl = getFileUrl;
const client_s3_2 = require("@aws-sdk/client-s3");
const deleteFile = async (filename) => {
    if (storageConfig.driver === 's3') {
        const client = new client_s3_1.S3Client({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        await client.send(new client_s3_2.DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: filename
        }));
    }
    else {
        const filePath = path_1.default.join(storageConfig.uploadsFolder, filename);
        if (fs_1.default.existsSync(filePath))
            fs_1.default.unlinkSync(filePath);
    }
};
exports.deleteFile = deleteFile;
