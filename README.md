# Photo Sharing Application

A modern, serverless photo sharing application built with React frontend and AWS Lambda backend. Users can upload images, view a gallery of photos, and automatically generate thumbnails using AWS services.

# Author
### Ishmael Gyamfi

## Features

- **Image Upload**: Drag & drop or browse to upload images (JPEG, PNG, GIF, WebP)
- **Automatic Thumbnails**: Server-side thumbnail generation using AWS Lambda
- **Gallery View**: Responsive grid layout with image previews
- **Modal View**: Full-size image viewing with overlay
- **Real-time Progress**: Upload progress tracking
- **Error Handling**: Comprehensive error handling and user feedback
- **File Validation**: Size and type validation (max 10MB)

## Architecture

### Frontend (React)
- Modern React application with hooks
- Responsive design with CSS Grid
- Axios for HTTP requests
- File upload with progress tracking
- Image preview and modal functionality

### Backend (AWS Lambda)
- **Upload Handler** (`uploadHandler.py`): Generates presigned URLs for S3 uploads
- **Image Resizer** (`imageResizer.py`): Automatically creates thumbnails when images are uploaded
- **List Images** (`listImages.py`): Retrieves gallery images and serves individual images

### AWS Services
- **S3**: Image storage (original and thumbnails)
- **Lambda**: Serverless functions for image processing
- **API Gateway**: REST API endpoints
- **CloudWatch**: Logging and monitoring

## Project Structure

```
├── src/                    # React frontend source
│   ├── App.js             # Main application component
│   ├── App.css            # Application styles
│   └── ...
├── public/                # Static assets
├── imageResizer.py        # Lambda: Thumbnail generation
├── uploadHandler.py       # Lambda: Upload URL generation
├── listImages.py          # Lambda: Gallery and image serving
├── package.json           # Frontend dependencies
└── README.md             # This file
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- AWS Account with configured services

### Frontend Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Update API endpoint**:
   - Edit `src/App.js`
   - Update `API_BASE_URL` with your API Gateway URL

3. **Start development server**:
   ```bash
   npm start
   ```
   Opens [http://localhost:3000](http://localhost:3000)

### AWS Backend Setup

1. **S3 Buckets**:
   - Create bucket for original images (e.g., `photo-share-buck`)
   - Create bucket for thumbnails (e.g., `photo-share-buck-resized`)
   - Configure CORS for web access

2. **Lambda Functions**:
   - Deploy `uploadHandler.py` as Lambda function
   - Deploy `imageResizer.py` as Lambda function with S3 trigger
   - Deploy `listImages.py` as Lambda function
   - Install required packages: `boto3`, `Pillow`

3. **API Gateway**:
   - Create REST API
   - Configure endpoints:
     - `POST /upload` → uploadHandler
     - `GET /images` → listImages
     - `GET /image/{key}` → listImages
   - Enable CORS

4. **Environment Variables**:
   - `THUMBNAIL_BUCKET`: Name of thumbnail S3 bucket

## Available Scripts

### `npm start`
Runs the app in development mode at [http://localhost:3000](http://localhost:3000)

### `npm test`
Launches the test runner in interactive watch mode

### `npm run build`
Builds the app for production to the `build` folder

### `npm run eject`
**Note: This is a one-way operation!** Ejects from Create React App

## Configuration

### Frontend Configuration
- Update `API_BASE_URL` in `src/App.js` with your API Gateway endpoint
- Modify upload limits and file types as needed

### Backend Configuration
- Set S3 bucket names in Lambda environment variables
- Configure thumbnail size in `imageResizer.py` (default: 300x300)
- Adjust image quality settings in thumbnail generation

## Deployment

### Frontend Deployment
1. Build the application: `npm run build`
2. Deploy `build/` folder to:
   - AWS S3 + CloudFront

### Backend Deployment
- Ensure proper IAM permissions for Lambda functions
- Configure S3 event triggers for image processing

## Features in Detail

### Image Upload Flow
1. User selects/drops image file
2. Frontend validates file type and size
3. Request presigned URL from upload handler
4. Direct upload to S3 using presigned URL
5. S3 triggers image resizer Lambda
6. Thumbnail generated and stored
7. Gallery refreshes with new image

### Thumbnail Generation
- Automatic processing on S3 upload events
- Maintains aspect ratio
- Converts to JPEG for optimization
- Handles various input formats (PNG, GIF, WebP, etc.)
- Error handling for corrupted images

### Gallery Features
- Responsive grid layout
- Lazy loading for performance
- Click to view full-size images
- File name and size display
- Refresh functionality

## Troubleshooting

### Common Issues

**Upload fails with 403 error**:
- Check S3 bucket permissions
- Verify presigned URL generation
- Ensure CORS is configured

**Images not displaying**:
- Verify S3 bucket public access settings
- Check API Gateway CORS configuration
- Confirm thumbnail generation is working

**Thumbnail generation fails**:
- Check Lambda function logs in CloudWatch
- Verify Pillow library is included in deployment
- Ensure proper S3 event trigger configuration
