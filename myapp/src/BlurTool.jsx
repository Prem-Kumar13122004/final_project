import React, { useState, useRef } from 'react';
import { Upload, Eraser, RotateCcw, Download, Plus, Minus, Sparkles, Loader2 } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

export default function BlurTool() {
  const [image, setImage] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  const [mode, setMode] = useState('blur');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const canvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          const maskCanvas = maskCanvasRef.current;
          const ctx = canvas.getContext('2d');
          const maskCtx = maskCanvas.getContext('2d');

          canvas.width = img.width;
          canvas.height = img.height;
          maskCanvas.width = img.width;
          maskCanvas.height = img.height;

          ctx.drawImage(img, 0, 0);
          maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

          setImage(event.target.result);
          setOriginalImage(event.target.result);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
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
    const maskCtx = maskCanvas.getContext('2d');
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    maskCtx.fillStyle = 'white';
    maskCtx.beginPath();
    maskCtx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    maskCtx.fill();

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
      const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i] > 0) {
          const x = (i / 4) % maskCanvas.width;
          const y = Math.floor(i / 4 / maskCanvas.width);
          ctx.fillRect(x, y, 1, 1);
        }
      }
    };
    img.src = originalImage;
  };

  const applyProcessing = async () => {
    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      
      const imageData = canvas.toDataURL('image/png');
      const maskData = maskCanvas.toDataURL('image/png');
      
      const endpoint = mode === 'blur' ? '/blur' : '/inpaint';
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: originalImage,
          mask: maskData,
          kernel_size: 35
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          setOriginalImage(data.result);
          clearMask();
        };
        img.src = data.result;
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Failed to connect to backend. Make sure the API is running on port 5000.');
      console.error('API Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    const canvas = canvasRef.current;
    const maskCtx = maskCanvas.getContext('2d');
    const ctx = canvas.getContext('2d');
    
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = originalImage;
  };

  const resetImage = () => {
    if (image) {
      setOriginalImage(image);
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
      };
      img.src = image;
      clearMask();
    }
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'blurred-image.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
            Smart Blur Tool
          </h1>
          <p className="text-slate-300 text-lg">
            Remove or blur people and objects from your images
          </p>
          <p className="text-purple-400 text-sm mt-2">
            ⚡ Powered by OpenCV Backend
          </p>
        </div>

        {!image ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 shadow-2xl">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current.click()}
              className="w-full py-16 border-4 border-dashed border-white/30 rounded-2xl hover:border-purple-400 hover:bg-white/5 transition-all duration-300 group"
            >
              <Upload className="w-20 h-20 mx-auto text-white/60 group-hover:text-purple-400 mb-4 transition-colors" />
              <p className="text-white text-xl font-semibold">Click to upload an image</p>
              <p className="text-slate-400 mt-2">or drag and drop</p>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
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

              <div className="bg-black/30 rounded-xl p-4 overflow-auto max-h-[600px] relative">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  className="max-w-full h-auto mx-auto cursor-crosshair"
                />
                <canvas
                  ref={maskCanvasRef}
                  className="hidden"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={applyProcessing}
                disabled={isProcessing}
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
                }}
                className="px-6 py-4 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-all duration-300"
              >
                New Image
              </button>
            </div>

            <div className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h3 className="text-white font-semibold mb-3 text-lg">Instructions:</h3>
              <ul className="text-slate-300 space-y-2">
                <li>• <strong>Paint</strong> over the area you want to blur or remove</li>
                <li>• Use <strong>+/-</strong> buttons to adjust brush size</li>
                <li>• Choose <strong>Blur</strong> mode to blur the selection</li>
                <li>• Choose <strong>Remove</strong> mode to inpaint and remove objects</li>
                <li>• Click <strong>Apply</strong> to send to backend for processing</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}