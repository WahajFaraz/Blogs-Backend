import express from 'express';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import { auth, blacklistToken } from '../middleware/auth.js';
import { deleteFile, uploadImage } from '../utils/cloudinary.js';
import { uploadMiddleware, validateImage, validateFileSize } from '../middleware/upload.js';
import fs from 'fs/promises';

const router = express.Router();

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || "thisismysupersecretformyportfoliobloggingwebsite",
    { expiresIn: '7d' }
  );
};

router.post('/signup', uploadMiddleware, [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let avatarFile = null;
  if (req.files && req.files.avatar) {
    avatarFile = req.files.avatar;
  }

  try {
    const { username, email, password, fullName, bio } = req.body;
    let socialLinks = req.body.socialLinks;

    if (socialLinks && typeof socialLinks === 'string') {
      try {
        socialLinks = JSON.parse(socialLinks);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid socialLinks format' });
      }
    }

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Email or username already exists' });
    }

    let avatarData = null;
    if (avatarFile) {
      if (!validateImage(avatarFile)) {
        return res.status(400).json({ error: 'Invalid avatar file type.' });
      }
      if (!validateFileSize(avatarFile, 2 * 1024 * 1024)) {
        return res.status(400).json({ error: 'Avatar file too large.' });
      }
      const result = await uploadImage(avatarFile, 'blogss/avatars');
      avatarData = {
        url: result.url,
        public_id: result.public_id,
        format: result.format,
        size: result.size
      };
    }

    const user = new User({
      username,
      email,
      password,
      fullName,
      bio: bio || '',
      socialLinks: socialLinks || {},
      avatar: avatarData
    });

    await user.save();

    // Generate token with userId in the payload
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || "thisismysupersecretformyportfoliobloggingwebsite",
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully. Please login to continue.',
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    if (avatarFile && avatarFile.tempFilePath) {
      try {
        await fs.unlink(avatarFile.tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
});

router.post('/login', [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid Credentials' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Invalid Credentials' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid Credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid Credentials' });
    }

    // Ensure user._id is a string
    const userId = user._id.toString();
    console.log('Generating token for user:', { 
      userId,
      email: user.email,
      type: typeof userId
    });

    // Generate token with userId in the payload
    const token = jwt.sign(
      { userId },
      process.env.JWT_SECRET || "thisismysupersecretformyportfoliobloggingwebsite",
      { expiresIn: '7d' }
    );

    console.log('Token generated successfully');

    res.json({
      message: 'Login successful',
      token,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Invalid Credentials' });
  }
});



// Get current user's profile
router.get('/me', auth, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Populate the followers and following arrays with user data
    const user = await User.findById(req.user._id)
      .select('-password -__v')
      .populate('followers', 'username fullName avatar')
      .populate('following', 'username fullName avatar');
      
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
router.get('/id/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .select('-password -email -isVerified -role -notificationPreferences')
      .populate('followers', 'username fullName avatar')
      .populate('following', 'username fullName avatar');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user by id error:', error);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/profile', auth, uploadMiddleware, [
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  let avatarFile = null;
  if (req.files && req.files.avatar) {
    avatarFile = req.files.avatar;
  }

  try {
    const updates = req.body;
    const allowedUpdates = ['fullName', 'bio', 'socialLinks', 'notificationPreferences'];
    
    const filteredUpdates = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if ((key === 'socialLinks' || key === 'notificationPreferences') && typeof updates[key] === 'string') {
          try {
            filteredUpdates[key] = JSON.parse(updates[key]);
          } catch (e) {
            return res.status(400).json({ error: `Invalid ${key} format` });
          }
        } else {
          filteredUpdates[key] = updates[key];
        }
      }
    }

    if (avatarFile) {
      if (!validateImage(avatarFile)) {
        return res.status(400).json({ error: 'Invalid avatar file type.' });
      }
      if (!validateFileSize(avatarFile, 2 * 1024 * 1024)) {
        return res.status(400).json({ error: 'Avatar file too large.' });
      }

      if (req.user.avatar && req.user.avatar.public_id) {
        await deleteFile(req.user.avatar.public_id).catch(err => console.error('Old avatar deletion failed:', err));
      }

      const result = await uploadImage(avatarFile, 'blogss/avatars');
      filteredUpdates.avatar = {
        url: result.url,
        public_id: result.public_id,
        format: result.format,
        size: result.size
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error during profile update' });
  } finally {
    if (avatarFile && avatarFile.tempFilePath) {
      try {
        await fs.unlink(avatarFile.tempFilePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
});

router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password -email -isVerified -role')
      .populate('followers', 'username fullName avatar')
      .populate('following', 'username fullName avatar');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout route
router.post('/logout', auth, async (req, res) => {
  try {
    // Add the token to the blacklist
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      blacklistToken(token);
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Error during logout' });
  }
});

// Follow user route
router.post('/follow/:userId', auth, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.userId) {
      return res.status(400).json({ error: 'You cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.userId);
    if (!userToFollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentUser = await User.findById(req.user._id);

    if (currentUser.following.includes(req.params.userId)) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    currentUser.following.push(req.params.userId);
    await currentUser.save();

    userToFollow.followers.push(req.user._id);
    await userToFollow.save();

    res.json({ message: 'User followed successfully' });

  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/unfollow/:userId', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const userToUnfollow = await User.findById(req.params.userId);

    if (!userToUnfollow) {
      return res.status(404).json({ error: 'User not found' });
    }

    currentUser.following = currentUser.following.filter(
      id => id.toString() !== req.params.userId
    );
    await currentUser.save();

    userToUnfollow.followers = userToUnfollow.followers.filter(
      id => id.toString() !== req.user._id.toString()
    );
    await userToUnfollow.save();

    res.json({ message: 'User unfollowed successfully' });

  } catch (error) {
    console.error('Unfollow user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's profile with populated data
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -refreshToken')
      .populate('blogs', 'title slug featuredImage publishedAt readTime')
      .populate('bookmarks', 'title slug featuredImage publishedAt readTime')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Handle missing avatar
    if (!user.avatar || !user.avatar.url) {
      user.avatar = {
        url: 'https://via.placeholder.com/150?text=U',
        publicId: 'placeholder-avatar'
      };
    }

    // Process blogs with missing images
    if (user.blogs) {
      user.blogs = user.blogs.map(blog => {
        if (!blog.featuredImage || !blog.featuredImage.url) {
          blog.featuredImage = {
            url: 'https://via.placeholder.com/800x450?text=No+Image+Available',
            publicId: 'placeholder'
          };
        }
        return blog;
      });
    }

    // Process bookmarks with missing images
    if (user.bookmarks) {
      user.bookmarks = user.bookmarks.map(blog => {
        if (!blog.featuredImage || !blog.featuredImage.url) {
          blog.featuredImage = {
            url: 'https://via.placeholder.com/800x450?text=No+Image+Available',
            publicId: 'placeholder'
          };
        }
        return blog;
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Error fetching profile' });
  }
});

// Get user's profile image
router.get('/profile-image', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('avatar');
    if (!user || !user.avatar) {
      return res.status(404).json({ error: 'Profile image not found' });
    }
    res.json(user.avatar);
  } catch (error) {
    console.error('Error fetching profile image:', error);
    res.status(500).json({ error: 'Failed to fetch profile image' });
  }
});

export default router;
