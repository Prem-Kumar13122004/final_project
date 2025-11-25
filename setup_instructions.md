# Setup Instructions

## Backend Setup
1. Install dependencies:
   pip install -r requirements.txt

2. Run the API:
   python blur_tool_api.py

   Server will start on http://localhost:5000

## Frontend Setup
1. Make sure the backend is running
2. Open the React app (or integrate into your project)
3. Upload an image and start editing!

## Testing
- Visit http://localhost:5000/api/health to check if API is running
- Should return: {"status": "ok"}