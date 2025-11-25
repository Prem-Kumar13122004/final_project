from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import base64
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app)  # Allow frontend to connect

class BlurProcessor:
    @staticmethod
    def decode_image(base64_str):
        """Convert base64 string to OpenCV image"""
        img_data = base64.b64decode(base64_str.split(',')[1])
        nparr = np.frombuffer(img_data, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    @staticmethod
    def encode_image(img):
        """Convert OpenCV image to base64 string"""
        _, buffer = cv2.imencode('.png', img)
        img_str = base64.b64encode(buffer).decode()
        return f"data:image/png;base64,{img_str}"
    
    @staticmethod
    def apply_blur(image, mask, kernel_size=35):
        """Apply Gaussian blur to masked region"""
        if not np.any(mask > 0):
            return image
        
        blurred = cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)
        result = image.copy()
        result[mask > 0] = blurred[mask > 0]
        return result
    
    @staticmethod
    def apply_inpaint(image, mask):
        """Apply inpainting to remove objects"""
        if not np.any(mask > 0):
            return image
        
        result = cv2.inpaint(image, mask, 3, cv2.INPAINT_TELEA)
        return result


@app.route('/api/blur', methods=['POST'])
def blur_image():
    """Apply blur to image"""
    try:
        data = request.json
        image_b64 = data['image']
        mask_b64 = data['mask']
        kernel_size = data.get('kernel_size', 35)
        
        # Decode images
        image = BlurProcessor.decode_image(image_b64)
        mask = BlurProcessor.decode_image(mask_b64)
        mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        
        # Apply blur
        result = BlurProcessor.apply_blur(image, mask, kernel_size)
        
        # Encode result
        result_b64 = BlurProcessor.encode_image(result)
        
        return jsonify({
            'success': True,
            'result': result_b64
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/inpaint', methods=['POST'])
def inpaint_image():
    """Remove objects using inpainting"""
    try:
        data = request.json
        image_b64 = data['image']
        mask_b64 = data['mask']
        
        # Decode images
        image = BlurProcessor.decode_image(image_b64)
        mask = BlurProcessor.decode_image(mask_b64)
        mask = cv2.cvtColor(mask, cv2.COLOR_BGR2GRAY)
        
        # Apply inpaint
        result = BlurProcessor.apply_inpaint(image, mask)
        
        # Encode result
        result_b64 = BlurProcessor.encode_image(result)
        
        return jsonify({
            'success': True,
            'result': result_b64
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("🚀 Blur Tool API starting...")
    print("📍 Server running on http://localhost:5000")
    print("✅ CORS enabled for frontend")
    app.run(debug=True, host='0.0.0.0', port=5000)