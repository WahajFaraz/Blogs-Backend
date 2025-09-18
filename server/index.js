import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { xss } from 'express-xss-sanitizer';
import hpp from 'hpp';
import userRoutes from './routes/user.js';
import blogRoutes from './routes/blog.js';
import mediaRoutes from './routes/media.js';

// Create Express app
// Create Express app instance
const app = express();

// 1) GLOBAL MIDDLEWARES

// Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.cloudinary.com'],
    },
  },
}));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Enable CORS
const allowedOrigins = [
  'https://blogspace-orpin.vercel.app/'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

const limiter = rateLimit({
  max: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
  message: 'Too many requests from this IP, please try again in 15 minutes!',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(mongoSanitize());

app.use(xss());

app.use(hpp({
  whitelist: [
    'duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price'
  ]
}));

// Compress all responses
app.use(compression());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/', apiLimiter);


// Connect to MongoDB with retry logic
const connectWithRetry = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://admin_00:0QHFFgpK6ecaP7LB@cluster0.j9dlacs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  }
};

const createApp = () => {
  const app = express();
  
  // Apply all middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Disable CSP for now as it can cause issues with Vercel
  }));

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  // For Vercel deployment, allow all origins in development
  const isProduction = process.env.NODE_ENV === 'production';
  
  const corsOptions = {
    origin: isProduction 
      ? ['https://blogspace.vercel.app', 'https://blogspace-two.vercel.app']
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true
  };

  app.use(cors(corsOptions));
  
  // Handle preflight requests
  app.options('*', cors(corsOptions));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', limiter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(mongoSanitize());
  app.use(xss());
  app.use(hpp());
  app.use(compression());

  // API Routes
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/blogs', blogRoutes);
  app.use('/api/v1/media', mediaRoutes);

  app.get('/', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  });

  app.get('/api', (req, res) => {
    res.json({
      status: 'success',
      message: "Welcome to BlogSpace API",
      version: '1.0.0',
      endpoints: {
        users: '/api/v1/users',
        blogs: '/api/v1/blogs',
        media: '/api/v1/media',
        health: '/'
      }
    });
  });

  // 404 handler for API routes
  app.use('/api/v1/*', (req, res) => {
    res.status(404).json({ 
      success: false,
      error: 'API endpoint not found',
      path: req.originalUrl,
      availableEndpoints: ['/api/v1/users', '/api/v1/blogs', '/api/v1/media']
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // If headers already sent, delegate to the default Express error handler
    if (res.headersSent) {
      return next(err);
    }
    
    const statusCode = err.statusCode || 500;
    const response = {
      status: 'error',
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { 
        stack: err.stack,
        error: err.message 
      })
    };
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
      response.message = 'Validation Error';
      response.errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json(response);
    }
    
    if (err.name === 'CastError') {
      response.message = 'Invalid ID format';
      return res.status(400).json(response);
    }
    
    // For Vercel, ensure we don't send stack traces in production
    if (process.env.NODE_ENV === 'production') {
      delete response.stack;
    }
    
    res.status(statusCode).json(response);
  });

  return app;
};

// For local development
if (process.env.NODE_ENV !== 'production') {
  const app = createApp();
  const PORT = process.env.PORT || 5001;
  
  const startServer = async () => {
    try {
      await mongoose.connect(process.env.MONGODB_URI 
        || "mongodb+srv://admin_00:0QHFFgpK6ecaP7LB@cluster0.j9dlacs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      console.log('MongoDB connected successfully');
      
      app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  };
  
  startServer();
}

// For Vercel
const vercelApp = createApp();

// Export the Vercel serverless function
export default async (req, res) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Pass the request to the Express app
  return vercelApp(req, res);
};
