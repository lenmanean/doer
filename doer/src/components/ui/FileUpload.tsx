'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { parseBlob } from 'music-metadata'

interface UploadedFile {
  id: string
  file: File
  progress: number
  status: 'uploading' | 'completed' | 'error'
  error?: string
  fileId?: string // Database ID after successful upload
}

interface FileUploadProps {
  onUpload?: (files: File[]) => void
  onFileRemove?: (fileId: string) => void
  onUploadComplete?: (uploadedFiles: any[]) => void // Callback when files are successfully uploaded
  onUploadStart?: () => void // Callback when upload starts
  onUploadProgress?: (progress: number) => void // Callback for upload progress (0-100)
  onUploadError?: () => void // Callback when upload fails
  maxFiles?: number
  maxSize?: number // in bytes
  acceptedTypes?: string[]
  className?: string
  disabled?: boolean
}

const FileUpload = ({
  onUpload,
  onFileRemove,
  onUploadComplete,
  onUploadStart,
  onUploadProgress,
  onUploadError,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB
  acceptedTypes = ['image/*', 'audio/*', 'video/*', '.pdf', '.doc', '.docx'],
  className,
  disabled = false
}: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)


  const getFileType = (file: File): 'image' | 'video' | 'audio' | 'document' => {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    return 'document'
  }

  const extractAudioMetadata = async (file: File): Promise<{ thumbnail?: string }> => {
    if (!file.type.startsWith('audio/')) {
      return {}
    }

    try {
      const metadata = await parseBlob(file)
      
      // Check if there's album art in the metadata
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0]
        const base64String = btoa(
          new Uint8Array(picture.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
        )
        const thumbnail = `data:${picture.format};base64,${base64String}`
        return { thumbnail }
      }
      
      return {}
    } catch (error) {
      console.log('Error extracting audio metadata:', error)
      return {}
    }
  }

  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size must be less than ${formatFileSize(maxSize)}`
    }
    
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1))
      }
      return file.type === type || file.name.toLowerCase().endsWith(type.toLowerCase())
    })
    
    if (!isValidType) {
      return 'File type not supported'
    }
    
    return null
  }

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const errors: string[] = []

    fileArray.forEach(file => {
      const error = validateFile(file)
      if (error) {
        errors.push(`${file.name}: ${error}`)
      } else {
        validFiles.push(file)
      }
    })

    if (errors.length > 0) {
      // You could show a toast notification here
      console.warn('File validation errors:', errors)
    }

    if (validFiles.length === 0) return

    // Upload files to Supabase
    onUploadStart?.()
    validFiles.forEach(async (file) => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('User not authenticated')
        }

        // Extract metadata (album art for audio files)
        let metadata: { thumbnail?: string } = { thumbnail: undefined }
        try {
          metadata = await extractAudioMetadata(file)
        } catch (metadataError) {
          // Continue without thumbnail if metadata extraction fails
        }

        // Create unique file path
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `${user.id}/${fileName}`

        // Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('media-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          throw uploadError
        }

        onUploadProgress?.(50)

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('media-files')
          .getPublicUrl(filePath)

        // Save file metadata to database
        const insertData: any = {
          user_id: user.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: getFileType(file),
          file_size: file.size,
          mime_type: file.type,
          storage_path: filePath
        }

        // Upload thumbnail to storage if it exists
        if (metadata.thumbnail) {
          try {
            const thumbnailBlob = await fetch(metadata.thumbnail).then(r => r.blob())
            const thumbnailPath = `${user.id}/thumbnails/${fileName.replace(/\.[^/.]+$/, '.jpg')}`
            
            const { data: thumbnailUploadData, error: thumbnailError } = await supabase.storage
              .from('media-files')
              .upload(thumbnailPath, thumbnailBlob, {
                cacheControl: '3600',
                upsert: false
              })
            
            if (!thumbnailError) {
              const { data: thumbnailUrlData } = supabase.storage
                .from('media-files')
                .getPublicUrl(thumbnailPath)
              insertData.thumbnail_url = thumbnailUrlData.publicUrl
            }
          } catch (thumbnailUploadError) {
            // Continue without thumbnail if upload fails
          }
        }

        const { data: dbData, error: dbError } = await supabase
          .from('media_files')
          .insert(insertData)
          .select()
          .single()

        if (dbError) {
          throw dbError
        }

        onUploadProgress?.(100)

        // Notify parent component
        onUploadComplete?.([dbData])

      } catch (error) {
        console.error('Upload error:', error)
        onUploadError?.()
      }
    })

    onUpload?.(validFiles)
  }, [maxSize, acceptedTypes, onUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) setIsDragOver(true)
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFiles(files)
    }
  }, [disabled, handleFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFiles(files)
    }
  }, [handleFiles])


  const openFileDialog = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        className={cn(
          'relative bg-white/5 backdrop-blur-sm border border-white/20 rounded-xl p-6 text-center transition-all duration-300 ease-in-out shadow-md overflow-hidden',
          isDragOver
            ? 'border-orange-500/50 bg-white/10 shadow-lg'
            : '',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled}
        />
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
            isDragOver ? 'bg-orange-500/20' : 'bg-white/10'
          )}>
            <Upload className={cn(
              'w-8 h-8 transition-colors',
              isDragOver ? 'text-orange-500' : 'text-white'
            )} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-base font-medium text-white tracking-tight">
              {isDragOver ? 'Drop files here' : 'Upload New Files'}
            </h3>
            <p className="text-sm text-slate-400">
              Drag and drop files here, or click to browse
            </p>
            <p className="text-xs text-slate-400">
              Supports images, audio, video, and documents up to {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export { FileUpload }
