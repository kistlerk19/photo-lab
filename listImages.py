import json
import boto3
import base64
import logging
import os
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3 = boto3.client('s3')

def lambda_handler(event, context):
    """Main Lambda handler for gallery operations"""
    try:
        # Log the incoming event for debugging
        logger.info(f"Event received: {json.dumps(event, default=str)}")
        
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        
        logger.info(f"Processing request: {http_method} {path}")
        
        # Route requests based on path
        if path == '/images' or path.endswith('/images'):
            return handle_gallery_request(event, context)
        elif path.startswith('/image/'):
            return handle_image_request(event, context)
        else:
            # Default to gallery request for backward compatibility
            return handle_gallery_request(event, context)
            
    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}")
        return create_error_response(500, 'Internal server error')

def handle_gallery_request(event, context):
    """Handle gallery list requests (/images endpoint)"""
    try:
        thumbnail_bucket = os.environ.get('THUMBNAIL_BUCKET', 'photo-share-buck-resized')
        
        logger.info(f"Listing images from bucket: {thumbnail_bucket}")
        
        response = s3.list_objects_v2(Bucket=thumbnail_bucket)
        images = []
        
        if 'Contents' in response:
            sorted_objects = sorted(
                response['Contents'],
                key=lambda x: x['LastModified'],
                reverse=True
            )
            
            for obj in sorted_objects:
                if not obj['Key'].startswith('thumb-'):
                    continue
                
                images.append({
                    'key': obj['Key'],
                    'url': f"https://{thumbnail_bucket}.s3.eu-west-1.amazonaws.com/{obj['Key']}",
                    'lastModified': obj['LastModified'].isoformat(),
                    'size': obj['Size']
                })
        
        logger.info(f"Found {len(images)} images")
        
        return create_success_response({
            'images': images,
            'count': len(images)
        })
    
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        logger.error(f"S3 ClientError in gallery request: {error_code} - {str(e)}")
        if error_code == 'NoSuchBucket':
            return create_error_response(404, 'Thumbnail bucket not found')
        elif error_code == 'AccessDenied':
            return create_error_response(403, 'Access denied to thumbnail bucket')
        else:
            return create_error_response(500, 'Failed to list images')
    except Exception as e:
        logger.error(f"Error in handle_gallery_request: {str(e)}")
        return create_error_response(500, 'Failed to retrieve gallery')
def handle_image_request(event, context):
    """Handle individual image requests (/image/{key} endpoint)"""
    try:
        path = event.get('path', '')
        
        # Extract image key from path
        if '/image/' not in path:
            return create_error_response(400, 'Invalid image path format')
        
        image_key = path.split('/image/')[-1]
        if not image_key:
            return create_error_response(400, 'Image key is required')
        
        # URL decode the image key
        import urllib.parse
        image_key = urllib.parse.unquote(image_key)
        
        thumbnail_bucket = os.environ.get('THUMBNAIL_BUCKET', 'photo-share-buck-resized')
        
        logger.info(f"Fetching image: {image_key} from bucket: {thumbnail_bucket}")
        
        # Get the image from S3
        response = s3.get_object(Bucket=thumbnail_bucket, Key=image_key)
        image_content = response['Body'].read()
        
        # Determine content type
        content_type = response.get('ContentType', 'image/jpeg')
        
        # Validate content type
        valid_content_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
        if content_type not in valid_content_types:
            logger.warning(f"Invalid content type: {content_type} for key: {image_key}")
            content_type = 'image/jpeg'
        
        # Encode image as base64
        image_base64 = base64.b64encode(image_content).decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': content_type,
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Cache-Control': 'public, max-age=86400',  # Cache for 24 hours
                'Content-Length': str(len(image_content))
            },
            'body': image_base64,
            'isBase64Encoded': True
        }
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        logger.error(f"S3 ClientError in image request: {error_code} - {str(e)}")
        
        if error_code == 'NoSuchKey':
            return create_error_response(404, 'Image not found')
        elif error_code == 'NoSuchBucket':
            return create_error_response(404, 'Thumbnail bucket not found')
        elif error_code == 'AccessDenied':
            return create_error_response(403, 'Access denied to image')
        else:
            return create_error_response(500, 'Failed to fetch image')
            
    except Exception as e:
        logger.error(f"Error in handle_image_request: {str(e)}")
        return create_error_response(500, 'Failed to retrieve image')

def get_api_gateway_url(event):
    """Get API Gateway URL from environment or event context"""
    # Try environment variable first
    api_gateway_url = os.environ.get('API_GATEWAY_URL')
    
    if api_gateway_url:
        return api_gateway_url.rstrip('/')
    
    # Fallback to constructing from request context
    if 'requestContext' in event:
        domain = event['requestContext'].get('domainName')
        stage = event['requestContext'].get('stage')
        
        if domain and stage:
            return f"https://{domain}/{stage}"
    
    # Last resort fallback
    return 'https://phz0r20w4l.execute-api.eu-west-1.amazonaws.com/prod'

def create_success_response(data):
    """Create a standardized success response"""
    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Content-Type': 'application/json'
        },
        'body': json.dumps(data)
    }

def create_error_response(status_code, message):
    """Create a standardized error response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'error': message,
            'statusCode': status_code
        })
    }