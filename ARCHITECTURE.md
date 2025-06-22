# Photo Sharing Application Architecture

## System Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │───▶│   API Gateway    │───▶│  Lambda Functions│
│  (Frontend)     │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │               ┌─────────────────┐
                                │               │   S3 Buckets    │
                                │               │ • Original      │
                                └──────────────▶│ • Thumbnails    │
                                                └─────────────────┘
```

## Component Architecture

### Frontend Layer
```
React Application
├── App.js (Main component)
├── Upload Component
│   ├── Drag & Drop
│   ├── File Validation
│   └── Progress Tracking
├── Gallery Component
│   ├── Image Grid
│   ├── Modal Viewer
│   └── Lazy Loading
└── API Client (Axios)
```

### API Layer
```
API Gateway
├── POST /upload → uploadHandler
├── GET /images → listImages
└── GET /image/{key} → listImages
```

### Backend Layer
```
Lambda Functions
├── uploadHandler.py
│   ├── Generate presigned URLs
│   ├── File validation
│   └── S3 upload preparation
├── imageResizer.py
│   ├── S3 event trigger
│   ├── Image processing (PIL)
│   └── Thumbnail generation
└── listImages.py
    ├── Gallery listing
    └── Image serving
```

### Storage Layer
```
S3 Buckets
├── photo-share-buck (Original images)
└── photo-share-buck-resized (Thumbnails)
```

## Data Flow

### Upload Flow
```
1. User selects image
   ↓
2. Frontend validates file
   ↓
3. Request presigned URL (POST /upload)
   ↓
4. Direct S3 upload with progress
   ↓
5. S3 triggers imageResizer Lambda
   ↓
6. Thumbnail generated and stored
   ↓
7. Gallery refreshes
```

### Gallery Flow
```
1. Load gallery (GET /images)
   ↓
2. Fetch thumbnail list from S3
   ↓
3. Display in responsive grid
   ↓
4. Click image → Modal view
   ↓
5. Load full image (GET /image/{key})
```

## Security Model

```
Frontend ←→ API Gateway (CORS enabled)
    ↓
Lambda Functions (IAM roles)
    ↓
S3 Buckets (Bucket policies)
```

### Permissions
- **Lambda → S3**: Read/Write access to both buckets
- **API Gateway → Lambda**: Invoke permissions
- **Frontend → API**: CORS-enabled public access
- **S3 → Public**: Read-only for thumbnails

## Scalability Considerations

- **Lambda**: Auto-scaling, concurrent execution
- **S3**: Unlimited storage, high availability
- **API Gateway**: Rate limiting, caching
- **Frontend**: CDN deployment (CloudFront)

## Monitoring & Logging

```
CloudWatch
├── Lambda Logs
├── API Gateway Metrics
├── S3 Access Logs
└── Error Tracking
```