import json
import boto3
from botocore.exceptions import ClientError
import uuid
import logging
import re

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3 = boto3.client('s3')

def lambda_handler(event, context):
    try:
        logger.info(f"Received event: {json.dumps(event)}")
        
        # Parse request body
        if event.get('body'):
            body = json.loads(event['body'])
        else:
            body = event
        
        logger.info(f"Parsed body: {json.dumps(body)}")
        
        # Get filename and content type
        original_filename = body.get('filename', f"image-{uuid.uuid4()}.jpg")
        content_type = body.get('contentType', 'image/jpeg')
        
        # Sanitize filename - remove any path traversal attempts and special characters
        safe_filename = re.sub(r'[^\w\-_\.]', '_', original_filename)
        
        # Add timestamp to avoid conflicts
        timestamp = str(uuid.uuid4())[:8]
        name_parts = safe_filename.rsplit('.', 1)
        if len(name_parts) == 2:
            final_filename = f"{name_parts[0]}_{timestamp}.{name_parts[1]}"
        else:
            final_filename = f"{safe_filename}_{timestamp}"
        
        logger.info(f"Original: {original_filename}, Safe: {final_filename}, Content-Type: {content_type}")
        
        # Validate content type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if content_type not in allowed_types:
            raise ValueError(f"Unsupported content type: {content_type}")
        
        # Generate presigned URL with additional parameters
        bucket_name = 'photo-share-buck'
        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': final_filename,
                'ContentType': content_type,
                'Metadata': {
                    'original-filename': original_filename,
                    'upload-timestamp': str(uuid.uuid4())
                }
            },
            ExpiresIn=3600  # URL expires in 1 hour
        )
        
        logger.info(f"Generated presigned URL for: {final_filename}")
        
        response_body = {
            'uploadUrl': presigned_url,
            'filename': final_filename,
            'originalFilename': original_filename
        }
        
        logger.info(f"Returning response body keys: {list(response_body.keys())}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'OPTIONS,POST'
            },
            'body': json.dumps(response_body)
        }
        
    except ValueError as ve:
        logger.error(f"Validation error: {str(ve)}")
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Validation error: {str(ve)}'})
        }
        
    except ClientError as ce:
        logger.error(f"AWS error: {str(ce)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'AWS service error: {str(ce)}'})
        }
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }