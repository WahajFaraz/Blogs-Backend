import fileUpload from 'express-fileupload';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadMiddleware = fileUpload({
  useTempFiles: true,
  tempFileDir: path.join(os.tmpdir(), 'blogss-temp'),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 40
  },
  abortOnLimit: true,
  responseOnLimit: 'File size limit has been reached',
  createParentPath: true,
  debug: "development" === 'development',
  cleanup: false
});

const validateFileType = (file, allowedTypes) => {
  if (!file) return false;
  
  const fileType = file.mimetype;
  return allowedTypes.includes(fileType);
};

const validateImage = (file) => {
  const allowedImageTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];
  return validateFileType(file, allowedImageTypes);
};

const validateVideo = (file) => {
  const allowedVideoTypes = [
    'video/mp4',
    'video/avi',
    'video/mov',
    'video/wmv',
    'video/flv',
    'video/webm'
  ];
  return validateFileType(file, allowedVideoTypes);
};

const validateFileSize = (file, maxSize = 10 * 1024 * 1024) => {
  if (!file) return false;
  return file.size <= maxSize;
};

export {
  uploadMiddleware,
  validateImage,
  validateVideo,
  validateFileSize
};