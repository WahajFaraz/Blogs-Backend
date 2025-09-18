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
const createApp = () => {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Disable CSP for Vercel compatibility
  }));

  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }

  const allowedOrigins = [
    'https://blogspace-orpin.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];

  // Configure CORS with explicit headers and preflight caching
  const corsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (process.env.NODE_ENV === 'development' || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Content-Range',
      'Set-Cookie',
      'Content-Length'
    ],
    exposedHeaders: [
      'Content-Range',
      'X-Content-Range',
      'Content-Length'
    ],
    credentials: true,
    maxAge: 86400, // Cache preflight request for 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
  
  // Apply CORS with the options
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions)); // Enable pre-flight for all routes
  
  // Handle preflight for all routes
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(','));
      return res.status(200).json({});
    }
    next();
  });

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again in 15 minutes!'
  });

  // Apply rate limiting to API routes
  app.use('/api', limiter);
  app.use('/api/v1', limiter);

  // Body parser, reading data from body into req.body
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Data sanitization against NoSQL query injection
  app.use(mongoSanitize());

  // Data sanitization against XSS
  app.use(xss());

  // Prevent parameter pollution
  app.use(hpp());

  // Compress all responses
  app.use(compression());

  // 2) ROUTES
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/blogs', blogRoutes);
  app.use('/api/v1/media', mediaRoutes);

  // Health check endpoint
  app.get('/', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
  });

  // API documentation endpoint
  app.get('/api', (req, res) => {
    res.json({
      status: 'success',
      message: 'Welcome to BlogSpace API',
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
      status: 'error',
      message: 'API endpoint not found',
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

  // 404 handler for all other routes
  app.all('*', (req, res) => {
    res.status(404).json({
      status: 'error',
      message: `Can't find ${req.originalUrl} on this server!`
    });
  });

  return app;
};

// Connect to MongoDB with retry logic
const connectWithRetry = async () => {
  const MONGODB_URI = process.env.MONGODB_URI || 
    process.env.MONGO_URI || 
    "mongodb+srv://admin_00:0QHFFgpK6ecaP7LB@cluster0.j9dlacs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
  
  const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(MONGODB_URI, options);
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    console.log('Retrying connection in 5 seconds...');
    return false;
  }
};

// For local development
if (process.env.NODE_ENV !== 'production') {
  const app = createApp();
  const PORT = process.env.PORT || 5001;
  
  const startServer = async () => {
    const isConnected = await connectWithRetry();
    if (!isConnected) {
      // If first attempt fails, retry once after 5 seconds
      setTimeout(async () => {
        const retryConnected = await connectWithRetry();
        if (!retryConnected) {
          console.error('Failed to connect to MongoDB after retry');
          process.exit(1);
        }
      }, 5000);
    }
    
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  };
  
  startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

// For Vercel 
const vercelApp = createApp();
// Export the Vercel serverless function
export default async (req, res) => {
  // Handle preflight requests
  
  if (!mongoose.connection.readyState) {
    const isConnected = await connectWithRetry();
    if (!isConnected) {
      return res.status(500).json({ 
        status: 'error',
        message: 'Database connection failed',
        ...(process.env.NODE_ENV === 'development' && {
          error: 'Failed to connect to MongoDB after retry'
        }) }); } 
  } // Pass the request to the Express app
  return vercelApp(req, res); };
