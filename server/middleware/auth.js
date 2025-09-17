import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// In-memory token blacklist (in production, use Redis or a database)
const tokenBlacklist = new Set();

// Function to blacklist a token
export const blacklistToken = (token) => {
  tokenBlacklist.add(token);
  console.log(`Token blacklisted: ${token.substring(0, 15)}...`);
};

// Function to check if a token is blacklisted
const isTokenBlacklisted = (token) => {
  return tokenBlacklist.has(token);
};

const auth = async (req, res, next) => {
  try {
    console.log('=== Auth Middleware ===');
    const authHeader = req.header('Authorization');
    console.log('Auth Header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'None');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header found');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Check if token is blacklisted
    if (isTokenBlacklisted(token)) {
      console.log('Attempted to use blacklisted token');
      return res.status(401).json({ error: 'Token has been invalidated' });
    }
    
    console.log('Token found, verifying...');

    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "thisismysupersecretformyportfoliobloggingwebsite");
      console.log('Token decoded successfully:', {
        userId: decoded.userId,
        iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'N/A',
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'N/A'
      });
      
      if (!decoded.userId) {
        console.error('No userId in token payload');
        return res.status(401).json({ error: 'Invalid token: Missing user ID' });
      }
      
      console.log('Looking up user with ID:', decoded.userId);
      const user = await User.findById(decoded.userId).select('-password').lean();
      
      if (!user) {
        console.error(`User not found in database for ID: ${decoded.userId}`);
        console.log('Available users in database:', await User.find({}).select('_id email'));
        return res.status(404).json({ error: 'User not found' });
      }

      console.log('User authenticated successfully:', {
        userId: user._id,
        email: user.email,
        username: user.username
      });
      req.user = user;
      next();
    } catch (jwtError) {
      console.error('JWT Error:', jwtError);
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token.' });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired.' });
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ 
      error: 'Server error during authentication.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "thisismysupersecretformyportfoliobloggingwebsite" );
      const user = await User.findById(decoded.userId).select('-password');
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "thisismysupersecretformyportfoliobloggingwebsite");
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    res.status(500).json({ error: 'Server error.' });
  }
};

export { auth, optionalAuth, adminAuth };