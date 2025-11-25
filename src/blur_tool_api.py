from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import base64
import sys

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

class BlurProcessor:
    @staticmethod
    def decode_image(base64_str):
        """Convert base64 string to OpenCV image"""
        try:
            # Remove data URI prefix if present
            if ',' in base64_str:
                base64_str = base64_str.split(',')[1]
            
            # Decode base64
            img_data = base64.b64decode(base64_str)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                raise ValueError("Failed to decode image")
            
            return img
        except Exception as e:
            print(f"Error decoding image: {e}")
            raise
    
    @staticmethod
    def encode_image(img):
        """Convert OpenCV image to base64 string"""
        try:
            # Encode image to PNG
            success, buffer = cv2.imencode('.png', img)
            if not success:
                raise ValueError("Failed to encode image")
            
            # Convert to base64
            img_str = base64.b64encode(buffer).decode('utf-8')
            return f"data:image/png;base64,{img_str}"
        except Exception as e:
            print(f"Error encoding image: {e}")
            raise
    
    @staticmethod
    def apply_blur(image, mask, kernel_size=35):
        """Apply Gaussian blur to masked region"""
        try:
            # Ensure kernel size is odd
            if kernel_size % 2 == 0:
                kernel_size += 1
            
            # Check if mask has any content
            if not np.any(mask > 0):
                print("Warning: Mask is empty")
                return image
            
            # Apply Gaussian blur to entire image
            blurred = cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)
            
            # Create result by combining original and blurred based on mask
            result = image.copy()
            
            # Apply blurred region where mask is white
            mask_binary = (mask > 127).astype(np.uint8)
            for c in range(3):  # For each color channel
                result[:, :, c] = np.where(mask_binary, 
                                           blurred[:, :, c], 
                                           image[:, :, c])
            
            return result
        except Exception as e:
            print(f"Error applying blur: {e}")
            raise
    
    @staticmethod
    def apply_inpaint(image, mask):
        """Apply inpainting to remove objects"""
        try:
            # Check if mask has any content
            if not np.any(mask > 0):
                print("Warning: Mask is empty")
                return image
            
            # Ensure mask is binary
            mask_binary = (mask > 127).astype(np.uint8)
            
            # Apply inpainting using Telea algorithm
            # inpaintRadius: radius of circular neighborhood
            result = cv2.inpaint(image, mask_binary, inpaintRadius=3, 
                               flags=cv2.INPAINT_TELEA)
            
            return result
        except Exception as e:
            print(f"Error applying inpaint: {e}")
            raise


@app.route('/api/blur', methods=['POST', 'OPTIONS'])
def blur_image():
    """Apply blur to image"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        print("Received blur request")
        
        # Get data from request
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        image_b64 = data.get('image')
        mask_b64 = data.get('mask')
        kernel_size = data.get('kernel_size', 35)
        
        if not image_b64 or not mask_b64:
            return jsonify({
                'success': False,
                'error': 'Missing image or mask data'
            }), 400
        
        print("Decoding images...")
        # Decode images
        image = BlurProcessor.decode_image(image_b64)
        mask = BlurProcessor.decode_image(mask_b64)
        
        # Convert mask to grayscale if needed
        if len(mask.shape) == 3:
            mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        
        print(f"Image shape: {image.shape}, Mask shape: {mask.shape}")
        print(f"Mask min: {mask.min()}, max: {mask.max()}")
        
        # Apply blur
        print("Applying blur...")
        result = BlurProcessor.apply_blur(image, mask, kernel_size)
        
        # Encode result
        print("Encoding result...")
        result_b64 = BlurProcessor.encode_image(result)
        
        print("Blur completed successfully")
        return jsonify({
            'success': True,
            'result': result_b64
        })
    
    except Exception as e:
        print(f"Error in blur_image: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/inpaint', methods=['POST', 'OPTIONS'])
def inpaint_image():
    """Remove objects using inpainting"""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        print("Received inpaint request")
        
        # Get data from request
        data = request.json
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        image_b64 = data.get('image')
        mask_b64 = data.get('mask')
        
        if not image_b64 or not mask_b64:
            return jsonify({
                'success': False,
                'error': 'Missing image or mask data'
            }), 400
        
        print("Decoding images...")
        # Decode images
        image = BlurProcessor.decode_image(image_b64)
        mask = BlurProcessor.decode_image(mask_b64)
        
        # Convert mask to grayscale if needed
        if len(mask.shape) == 3:
            mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        
        print(f"Image shape: {image.shape}, Mask shape: {mask.shape}")
        
        # Apply inpaint
        print("Applying inpaint...")
        result = BlurProcessor.apply_inpaint(image, mask)
        
        # Encode result
        print("Encoding result...")
        result_b64 = BlurProcessor.encode_image(result)
        
        print("Inpaint completed successfully")
        return jsonify({
            'success': True,
            'result': result_b64
        })
    
    except Exception as e:
        print(f"Error in inpaint_image: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'opencv_version': cv2.__version__,
        'python_version': sys.version
    })


@app.errorhandler(404)
def not_found(e):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Smart Blur Tool API Server")
    print("=" * 60)
    print("📍 Server: http://localhost:5000")
    print("✅ CORS: Enabled")
    print("📚 Endpoints:")
    print("   - GET  /api/health  (Health check)")
    print("   - POST /api/blur    (Apply blur)")
    print("   - POST /api/inpaint (Remove objects)")
    print("=" * 60)
    print()
    
    # Run server
    app.run(
        debug=True, 
        host='0.0.0.0', 
        port=5000,
        threaded=True
    )