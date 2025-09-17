import express from 'express';
import { auth } from '../middleware/auth.js';
import { uploadMiddleware, validateImage, validateVideo, validateFileSize } from '../middleware/upload.js';
import { uploadImage, uploadVideo, deleteFile } from '../utils/cloudinary.js';

const router = express.Router();

router.post('/upload-image', auth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;

    if (!validateImage(file)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
      });
    }

    if (!validateFileSize(file, 5 * 1024 * 1024)) {
      return res.status(400).json({ 
        error: 'File too large. Image must be less than 5MB.' 
      });
    }

    const result = await uploadImage(file, 'blogss/images');

    res.json({
      message: 'Image uploaded successfully',
      media: {
        type: 'image',
        url: result.url,
        public_id: result.public_id,
        format: result.format,
        size: result.size
      }
    });

  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

router.post('/upload-video', auth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;

    if (!validateVideo(file)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only MP4, AVI, MOV, WMV, FLV, and WebM videos are allowed.' 
      });
    }

    if (!validateFileSize(file, 10 * 1024 * 1024)) {
      return res.status(400).json({ 
        error: 'File too large. Video must be less than 10MB.' 
      });
    }

    const result = await uploadVideo(file, 'blogss/videos');

    res.json({
      message: 'Video uploaded successfully',
      media: {
        type: 'video',
        url: result.url,
        public_id: result.public_id,
        format: result.format,
        size: result.size,
        duration: result.duration
      }
    });

  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

router.post('/upload-avatar', auth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;

    if (!validateImage(file)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' 
      });
    }

    if (!validateFileSize(file, 2 * 1024 * 1024)) {
      return res.status(400).json({ 
        error: 'File too large. Avatar must be less than 2MB.' 
      });
    }

    const result = await uploadImage(file, 'blogss/avatars');

    res.json({
      message: 'Avatar uploaded successfully',
      avatar: {
        url: result.url,
        public_id: result.public_id,
        format: result.format,
        size: result.size
      }
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

router.delete('/:public_id', auth, async (req, res) => {
  try {
    const { public_id } = req.params;

    if (!public_id) {
      return res.status(400).json({ error: 'Public ID is required' });
    }

    const result = await deleteFile(public_id);

    res.json({
      message: 'File deleted successfully',
      result
    });

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

router.post('/upload-blog-media', auth, uploadMiddleware, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;
    let result;

    if (validateImage(file)) {
      if (!validateFileSize(file, 5 * 1024 * 1024)) {
        return res.status(400).json({ 
          error: 'File too large. Image must be less than 5MB.' 
        });
      }
      result = await uploadImage(file, 'blogss/blog-images');
    } else if (validateVideo(file)) {
      if (!validateFileSize(file, 10 * 1024 * 1024)) {
        return res.status(400).json({ 
          error: 'File too large. Video must be less than 10MB.' 
        });
      }
      result = await uploadVideo(file, 'blogss/blog-videos');
    } else {
      return res.status(400).json({ 
        error: 'Invalid file type. Only images and videos are allowed.' 
      });
    }

    res.json({
      message: 'Media uploaded successfully',
      media: {
        type: validateImage(file) ? 'image' : 'video',
        url: result.url,
        public_id: result.public_id,
        format: result.format,
        size: result.size,
        ...(validateVideo(file) && { duration: result.duration })
      }
    });

  } catch (error) {
    console.error('Blog media upload error:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

export default router;
