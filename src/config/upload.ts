import multer, { StorageEngine } from 'multer';
import fs from 'fs';
import path from 'path';
import { S3Client } from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';



export const UPLOADS_PATH = path.join(process.cwd(), "uploads");
const storageDriver = process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';

const storageConfig = {
  driver: storageDriver as 'local' | 's3',
  uploadsFolder: path.resolve(__dirname, '..', '..', 'uploads')
};

let storage: StorageEngine;

if (storageConfig.driver === 's3') {
  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    }
  });

  storage = multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME || '',
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    }
  });
} else {
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
    storage = multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(UPLOADS_PATH)) {
        fs.mkdirSync(UPLOADS_PATH, { recursive: true });
      }
      cb(null, UPLOADS_PATH);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    }
  });
}

export const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const getFileUrl = (filename: string): string =>
  storageConfig.driver === 's3'
    ? `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`
    : `/uploads/${filename}`;

import { DeleteObjectCommand } from '@aws-sdk/client-s3';
export const deleteFile = async (filename: string): Promise<void> => {
  if (storageConfig.driver === 's3') {
    const client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    await client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: filename
    }));
  } else {
    const filePath = path.join(storageConfig.uploadsFolder, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};
