# BlogSpace API Server

This is the backend API server for the BlogSpace application, built with Node.js, Express, and MongoDB.

## Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- MongoDB Atlas account or local MongoDB instance
- Vercel account (for deployment)

## Environment Variables

Create a `.env` file in the root directory and add the following environment variables:

```env
# MongoDB Connection
MONGODB_URI=your_mongodb_connection_string

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=90d

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Server Configuration
PORT=5001
NODE_ENV=development
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment to Vercel

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to [Vercel](https://vercel.com) and import your project
3. Configure the environment variables in the Vercel dashboard
4. Deploy!

### Required Vercel Environment Variables

Make sure to set these environment variables in your Vercel project settings:

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `NODE_ENV=production`

## API Documentation

API documentation is available at `/api-docs` when running the server in development mode.

## License

This project is licensed under the MIT License.
