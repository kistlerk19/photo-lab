import json
import boto3
from PIL import Image
import io
import urllib.parse
import logging
import os

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize S3 client
s3 = boto3.client('s3')

def lambda_handler(event, context):
    """
    AWS Lambda function to create thumbnails when images are uploaded to S3
    Triggered by S3 PUT events
    """
    try:
        logger.info(f"Lambda function started. Event: {json.dumps(event, default=str)}")
        
        # Process each record in the event
        for record in event['Records']:
            process_s3_record(record)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'All thumbnails processed successfully',
                'processedRecords': len(event['Records'])
            })
        }
        
    except Exception as e:
        logger.error(f"Lambda function error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to process image'
            })
        }

def process_s3_record(record):
    """Process a single S3 record"""
    try:
        # Extract S3 event details
        bucket = record['s3']['bucket']['name']
        key = urllib.parse.unquote_plus(record['s3']['object']['key'], encoding='utf-8')
        
        logger.info(f"Processing image: {key} from bucket: {bucket}")
        
        # Skip if it's already a thumbnail
        if key.startswith('thumb-') or key.startswith('resized-'):
            logger.info(f"Skipping thumbnail file: {key}")
            return
        
        # Skip non-image files
        if not is_image_file(key):
            logger.info(f"Skipping non-image file: {key}")
            return
        
        # Define thumbnail bucket and key
        thumbnail_bucket = os.environ.get('THUMBNAIL_BUCKET', 'photo-share-buck-resized')
        thumbnail_key = f"thumb-{key}"
        
        # Check if thumbnail already exists
        if thumbnail_exists(thumbnail_bucket, thumbnail_key):
            logger.info(f"Thumbnail already exists: {thumbnail_key}")
            return
        
        # Download the original image
        image_content = download_image(bucket, key)
        
        # Create thumbnail
        thumbnail_data = create_thumbnail(image_content, key)
        
        # Upload thumbnail to S3
        upload_thumbnail(thumbnail_bucket, thumbnail_key, thumbnail_data, key, bucket)
        
        logger.info(f"Successfully processed: {key} -> {thumbnail_key}")
        
    except Exception as e:
        logger.error(f"Error processing S3 record: {str(e)}")
        raise

def is_image_file(key):
    """Check if the file is an image based on extension"""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'}
    file_extension = os.path.splitext(key.lower())[1]
    return file_extension in image_extensions

def thumbnail_exists(bucket, key):
    """Check if thumbnail already exists in S3"""
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except s3.exceptions.ClientError as e:
        if e.response['Error']['Code'] == '404':
            return False
        raise

def download_image(bucket, key):
    """Download image from S3"""
    try:
        logger.info(f"Downloading image: {key} from bucket: {bucket}")
        response = s3.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()
    except Exception as e:
        logger.error(f"Error downloading image {key}: {str(e)}")
        raise

def create_thumbnail(image_content, original_key):
    """Create thumbnail from image content"""
    try:
        logger.info(f"Creating thumbnail for: {original_key}")
        
        # Open the image
        with Image.open(io.BytesIO(image_content)) as image:
            # Log original image info
            logger.info(f"Original image - Size: {image.size}, Mode: {image.mode}, Format: {image.format}")
            
            # Handle different image modes
            if image.mode in ('RGBA', 'LA', 'P'):
                # Convert to RGB with white background
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                
                if image.mode == 'P':
                    # Convert palette mode to RGBA first
                    image = image.convert('RGBA')
                
                if image.mode == 'RGBA':
                    # Paste with alpha channel as mask
                    rgb_image.paste(image, mask=image.split()[-1])
                else:
                    # For LA mode
                    rgb_image.paste(image, mask=image.split()[-1] if len(image.split()) > 1 else None)
                
                image = rgb_image
            
            # Create thumbnail (max 300x300, maintain aspect ratio)
            thumbnail_size = (300, 300)
            image.thumbnail(thumbnail_size, Image.Resampling.LANCZOS)
            
            logger.info(f"Thumbnail size: {image.size}")
            
            # Save thumbnail to bytes buffer
            thumbnail_buffer = io.BytesIO()
            
            # Use JPEG format for thumbnails (smaller file size)
            image.save(
                thumbnail_buffer, 
                format='JPEG', 
                quality=85, 
                optimize=True,
                progressive=True
            )
            
            thumbnail_buffer.seek(0)
            thumbnail_data = thumbnail_buffer.getvalue()
            
            logger.info(f"Thumbnail created - Size: {len(thumbnail_data)} bytes")
            return thumbnail_data
            
    except Exception as e:
        logger.error(f"Error creating thumbnail for {original_key}: {str(e)}")
        raise

def upload_thumbnail(thumbnail_bucket, thumbnail_key, thumbnail_data, original_key, original_bucket):
    """Upload thumbnail to S3"""
    try:
        logger.info(f"Uploading thumbnail: {thumbnail_key} to bucket: {thumbnail_bucket}")
        
        s3.put_object(
            Bucket=thumbnail_bucket,
            Key=thumbnail_key,
            Body=thumbnail_data,
            ContentType='image/jpeg',
            CacheControl='public, max-age=31536000',  # Cache for 1 year
            Metadata={
                'original-key': original_key,
                'original-bucket': original_bucket,
                'thumbnail-created': 'true'
            }
        )
        
        logger.info(f"Thumbnail uploaded successfully: {thumbnail_key}")
        
    except Exception as e:
        logger.error(f"Error uploading thumbnail {thumbnail_key}: {str(e)}")
        raise