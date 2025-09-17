import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "djzbvw5kc" ,
  api_key: process.env.CLOUDINARY_API_KEY || 618852333748735 ,
  api_secret: process.env.CLOUDINARY_API_SECRET || "autfIbYmMOoDWO8WZt8f1paKtmY"
});

const uploadImage = async (file, folder) => {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: folder,
        resource_type: 'image',
    });
    return {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        size: result.bytes,
    };
};

const uploadVideo = async (file, folder) => {
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: folder,
        resource_type: 'video',
    });
    return {
        url: result.secure_url,
        public_id: result.public_id,
        format: result.format,
        size: result.bytes,
        duration: result.duration,
    };
};

const deleteFile = async (public_id) => {
    if (public_id && !public_id.startsWith('local:')) {
        const resource_type = public_id.includes('video') ? 'video' : 'image';
        return await cloudinary.uploader.destroy(public_id, { resource_type });
    }
};

export { uploadImage, uploadVideo, deleteFile };
