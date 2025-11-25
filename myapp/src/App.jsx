import React, { useState, useRef, useEffect } from 'react';
import { Upload, Eraser, RotateCcw, Download, Plus, Minus, Sparkles, Loader2, AlertCircle } from 'lucide-react';

// Backend URL - change this to your backend URL when deployed
const API_URL = 'http://localhost:5000/api';

export default function App() {
  const [image, setImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [mode, setMode] = useState('blur');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking');
  
  const canvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`, { 
        method: 'GET',
        mode: 'cors'
      });
      if (response.ok) {
        setBackendStatus('online');
        setError(null);
      } else {
        setBackendStatus('offline');
        setError('Backend is not responding correctly');
      }
    } catch (err) {
      setBackendStatus('offline');
      setError('Cannot connect to backend. Make sure it\'s running on port 5000');
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image size should be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const maskCanvas = maskCanvasRef.current;
        
        if (!canvas || !maskCanvas) return;

        const ctx = canvas.getContext('2d');
        const maskCtx = maskCanvas.getContext('2d');

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;
        maskCanvas.width = img.width;
        maskCanvas.height = img.height;

        // Draw image and clear mask
        ctx.drawImage(img, 0, 0);
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

        setImage(event.target.result);
        setOriginalImage(event.target.result);
        setError(null);
      };
      img.onerror = () => {
        setError('Failed to load image');
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsDataURL(file);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const draw = (e) => {
    if (!isDrawing && e.type !== 'mousedown') return;

    const pos = getMousePos(e);
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    
    if (!maskCanvas || !canvas) return;

    const maskCtx = maskCanvas.getContext('2d');
    const ctx = canvas.getContext('2d');

    // Draw white on mask canvas
    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    maskCtx.fill();

    // Update preview with red overlay
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      
      // Draw red overlay where mask is white
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = 'red';
      
      const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) {
          const x = (i / 4) % maskCanvas.width;
          const y = Math.floor(i / 4 / maskCanvas.width);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.globalAlpha = 1.0;
    };
    img.src = originalImage;
  };

  const applyProcessing = async () => {
    if (backendStatus !== 'online') {
      setError('Backend is offline. Please start the backend server first.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      const maskCanvas = maskCanvasRef.current;
      if (!maskCanvas) throw new Error('Mask canvas not found');

      const maskData = maskCanvas.toDataURL('image/png');
      
      // Check if mask has any content
      const maskCtx = maskCanvas.getContext('2d');
      const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const hasContent = imageData.data.some(pixel => pixel > 0);
      
      if (!hasContent) {
        setError('Please draw on the image first to select an area');
        setIsProcessing(false);
        return;
      }

      const endpoint = mode === 'blur' ? '/blur' : '/inpaint';
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
        body: JSON.stringify({
          image: originalImage,
          mask: maskData,
          kernel_size: 35
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          setOriginalImage(data.result);
          clearMask();
        };
        img.onerror = () => {
          setError('Failed to load processed image');
        };
        img.src = data.result;
      } else {
        setError(data.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      setError(`Failed to process: ${error.message}`);
      setBackendStatus('offline');
    } finally {
      setIsProcessing(false);
    }
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    
    if (!maskCanvas || !canvas) return;

    const maskCtx = maskCanvas.getContext('2d');
    const ctx = canvas.getContext('2d');
    
    // Clear mask (fill with black)
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    // Redraw original image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = originalImage;
  };

  const resetImage = () => {
    if (!image) return;
    
    setOriginalImage(image);
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
    };
    img.src = image;
    clearMask();
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `${mode}-processed-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            Smart Blur Tool
          </h1>
          <p className="text-slate-300 text-lg">
            Remove or blur people and objects from your images
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div className={`w-2 h-2 rounded-full ${backendStatus === 'online' ? 'bg-green-500' : backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
            <p className={`text-sm ${backendStatus === 'online' ? 'text-green-400' : backendStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'}`}>
              Backend: {backendStatus === 'online' ? 'Connected' : backendStatus === 'offline' ? 'Offline' : 'Checking...'}
            </p>
            {backendStatus === 'offline' && (
              <button 
                onClick={checkBackendHealth}
                className="ml-2 text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
              >
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-200 font-semibold">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-200"
            >
              ×
            </button>
          </div>
        )}

        {!image ? (
          /* Upload Area */
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 shadow-2xl">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-16 border-4 border-dashed border-white/30 rounded-2xl hover:border-purple-400 hover:bg-white/5 transition-all duration-300 group"
            >
              <Upload className="w-20 h-20 mx-auto text-white/60 group-hover:text-purple-400 mb-4 transition-colors" />
              <p className="text-white text-xl font-semibold">Click to upload an image</p>
              <p className="text-slate-400 mt-2">PNG, JPG up to 10MB</p>
            </button>
          </div>
        ) : (
          /* Editor Area */
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
              {/* Controls */}
              <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
                <div className="flex gap-3">
                  <button
                    onClick={() => setMode('blur')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                      mode === 'blur'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="8" strokeWidth="2" opacity="0.5"/>
                    </svg>
                    Blur
                  </button>
                  <button
                    onClick={() => setMode('inpaint')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 ${
                      mode === 'inpaint'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/50'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-xl">
                  <button
                    onClick={() => setBrushSize(Math.max(5, brushSize - 5))}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Minus className="w-5 h-5 text-white" />
                  </button>
                  <div className="text-white font-semibold min-w-[60px] text-center">
                    {brushSize}px
                  </div>
                  <button
                    onClick={() => setBrushSize(Math.min(100, brushSize + 5))}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Plus className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Canvas Area */}
              <div className="bg-black/30 rounded-xl p-4 overflow-auto max-h-[600px] relative">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className="max-w-full h-auto mx-auto cursor-crosshair"
                  style={{ imageRendering: 'auto' }}
                />
                <canvas
                  ref={maskCanvasRef}
                  className="hidden"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={applyProcessing}
                disabled={isProcessing || backendStatus !== 'online'}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 flex items-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing...
                  </>
                ) : mode === 'blur' ? (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="8" strokeWidth="2" opacity="0.5"/>
                    </svg>
                    Apply Blur
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    Remove Object
                  </>
                )}
              </button>

              <button
                onClick={clearMask}
                className="px-6 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
              >
                <Eraser className="w-5 h-5" />
                Clear Mask
              </button>

              <button
                onClick={resetImage}
                className="px-6 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Reset
              </button>

              <button
                onClick={downloadImage}
                className="px-6 py-4 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all duration-300 flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download
              </button>

              <button
                onClick={() => {
                  setImage(null);
                  setOriginalImage(null);
                  setError(null);
                }}
                className="px-6 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-300"
              >
                New Image
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-white font-semibold mb-3 text-lg">📖 Instructions:</h3>
              <ul className="text-slate-300 space-y-2">
                <li>• <strong>Paint</strong> over the area you want to blur or remove</li>
                <li>• Use <strong>+/-</strong> buttons to adjust brush size</li>
                <li>• Choose <strong>Blur</strong> mode to blur the selection</li>
                <li>• Choose <strong>Remove</strong> mode to inpaint and remove objects</li>
                <li>• Click <strong>Apply</strong> to process with backend</li>
                <li>• Backend must be running on <code className="bg-black/30 px-2 py-1 rounded">localhost:5000</code></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}