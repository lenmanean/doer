'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Check, RotateCw } from 'lucide-react'

interface ImageCropperProps {
  image: string
  onCropComplete: (croppedImageBlob: Blob) => void
  onCancel: () => void
}

export function ImageCropper({ image, onCropComplete, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // Load image
  useEffect(() => {
    const img = new Image()
    img.src = image
    img.onload = () => {
      setImageObj(img)
      // Center the image initially
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const centerX = (canvas.width - img.width) / 2
        const centerY = (canvas.height - img.height) / 2
        setPosition({ x: centerX, y: centerY })
      }
    }
  }, [image])

  // Draw on canvas
  useEffect(() => {
    if (!imageObj || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Save context state
    ctx.save()

    // Move to center for rotation
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(scale, scale)
    ctx.translate(-canvas.width / 2, -canvas.height / 2)

    // Draw image
    ctx.drawImage(imageObj, position.x, position.y)

    // Restore context
    ctx.restore()

    // Draw circular crop overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Cut out circle
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2, 150, 0, Math.PI * 2)
    ctx.fill()

    // Draw circle border
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2, 150, 0, Math.PI * 2)
    ctx.stroke()
  }, [imageObj, scale, rotation, position])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleCrop = () => {
    if (!canvasRef.current || !imageObj) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create a new canvas for the cropped image
    const croppedCanvas = document.createElement('canvas')
    const cropSize = 300
    croppedCanvas.width = cropSize
    croppedCanvas.height = cropSize
    const croppedCtx = croppedCanvas.getContext('2d')
    if (!croppedCtx) return

    // Calculate crop area from main canvas
    const centerX = canvas.width / 2
    const centerY = canvas.height / 2
    const radius = 150

    // First, create circular clipping path
    croppedCtx.save()
    croppedCtx.beginPath()
    croppedCtx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2)
    croppedCtx.clip()

    // Now draw the image with transformations
    croppedCtx.translate(cropSize / 2, cropSize / 2)
    croppedCtx.rotate((rotation * Math.PI) / 180)
    croppedCtx.scale(scale, scale)
    
    // Calculate the portion of the image visible in the circle
    const offsetX = (centerX - position.x) / scale
    const offsetY = (centerY - position.y) / scale
    
    croppedCtx.drawImage(
      imageObj,
      -offsetX,
      -offsetY,
      imageObj.width,
      imageObj.height
    )
    croppedCtx.restore()

    // Convert to blob
    croppedCanvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob)
      }
    }, 'image/png')
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-panel p-6 max-w-2xl w-full"
      >
        <div className="mb-4">
          <h2 className="text-2xl font-bold text-[#d7d2cb] mb-2">Crop Profile Picture</h2>
          <p className="text-[#d7d2cb]/70 text-sm">Drag to reposition, use controls to adjust</p>
        </div>

        {/* Canvas */}
        <div className="mb-6 flex justify-center">
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="border border-white/20 rounded-lg cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* Controls */}
        <div className="space-y-4 mb-6">
          {/* Zoom */}
          <div>
            <label className="block text-sm font-medium text-[#d7d2cb] mb-2">
              Zoom: {scale.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Rotation */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#d7d2cb]">
                Rotation: {rotation}°
              </label>
              <button
                onClick={() => setRotation((rotation + 90) % 360)}
                className="p-2 bg-white/5 border border-white/20 rounded-lg hover:bg-white/10 transition-colors"
              >
                <RotateCw className="w-4 h-4 text-[#d7d2cb]" />
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={rotation}
              onChange={(e) => setRotation(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/30 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Apply
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

