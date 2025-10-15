'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Eye, 
  MoreVertical, 
  FileText, 
  Image, 
  Music, 
  Video,
  Calendar,
  HardDrive,
  Edit3
} from 'lucide-react'
import { Button } from './Button'
import { Badge } from './Badge'
import { Card, CardContent } from './Card'
import { Modal } from './Modal'
import { cn, formatFileSize, formatRelativeTime } from '@/lib/utils'

interface MediaFile {
  id: string
  name: string
  type: 'image' | 'audio' | 'video' | 'document'
  size: number
  url: string
  thumbnail?: string
  uploadedAt: Date
  duration?: number // for audio/video files
  metadata?: {
    width?: number
    height?: number
    format?: string
  }
}

interface MediaGalleryProps {
  files: MediaFile[]
  onFileSelect?: (file: MediaFile) => void
  onFileDelete?: (fileId: string) => void
  onFileDownload?: (fileId: string) => void
  onFileRename?: (fileId: string, newName: string) => void
  className?: string
  gridCols?: 2 | 3 | 4 | 6
}

const MediaGallery = ({
  files,
  onFileSelect,
  onFileDelete,
  onFileDownload,
  onFileRename,
  className,
  gridCols = 4
}: MediaGalleryProps) => {
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<'all' | 'image' | 'audio' | 'video' | 'document'>('all')
  const [isRenaming, setIsRenaming] = useState(false)
  const [newFileName, setNewFileName] = useState('')

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return Image
      case 'audio':
        return Music
      case 'video':
        return Video
      case 'document':
        return FileText
      default:
        return FileText
    }
  }

  const getFileTypeColor = (type: string) => {
    switch (type) {
      case 'image':
        return 'bg-green-100 text-green-800'
      case 'audio':
        return 'bg-blue-100 text-blue-800'
      case 'video':
        return 'bg-purple-100 text-purple-800'
      case 'document':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-slate-100 text-slate-800'
    }
  }

  const filteredFiles = files.filter(file => 
    filter === 'all' || file.type === filter
  )

  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    6: 'grid-cols-3 md:grid-cols-6'
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleRename = () => {
    if (selectedFile && newFileName.trim() && onFileRename) {
      onFileRename(selectedFile.id, newFileName.trim())
      setIsRenaming(false)
      setNewFileName('')
    }
  }

  const startRename = () => {
    if (selectedFile) {
      setNewFileName(selectedFile.name)
      setIsRenaming(true)
    }
  }

  const cancelRename = () => {
    setIsRenaming(false)
    setNewFileName('')
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-[#d7d2cb]">Media Library</h2>
          <p className="text-[#d7d2cb]/70">{filteredFiles.length} files</p>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Type Filter */}
          <div className="flex items-center space-x-2">
            {(['all', 'image', 'audio', 'video', 'document'] as const).map((type) => (
              <Button
                key={type}
                variant={filter === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(type)}
                className={cn(
                  'capitalize focus-visible:ring-0 focus-visible:ring-offset-0',
                  filter === type 
                    ? 'text-white bg-[#ff7f00] border border-[#ff7f00] hover:bg-[#ff7f00]/90' 
                    : 'text-[#d7d2cb]/70 hover:text-[#d7d2cb] hover:bg-white/10 border-white/20'
                )}
              >
                {type}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className={cn('grid gap-4', gridColsClass[gridCols])}>
          {filteredFiles.map((file, index) => {
            const Icon = getFileIcon(file.type)
            
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  hover
                  className="group cursor-pointer overflow-hidden"
                  onClick={() => {
                    setSelectedFile(file)
                    onFileSelect?.(file)
                  }}
                >
                  <CardContent className="p-0">
                    {/* File Preview */}
                    <div className="relative aspect-square bg-white/5 overflow-hidden">
                      {file.type === 'image' ? (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : file.thumbnail ? (
                        <img
                          src={file.thumbnail}
                          alt={file.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon className="w-12 h-12 text-[#d7d2cb]/60" />
                        </div>
                      )}
                      
                      {/* Overlay Actions */}
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onFileDownload?.(file.id)
                          }}
                          className="w-10 h-10 backdrop-blur-sm bg-white/10 border border-white/20 text-[#d7d2cb] hover:border-[#ff7f00]/50 hover:text-[#ff7f00] hover:bg-white/15 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
                          title="Download file"
                        >
                          <Download className="w-4 h-4 text-[#d7d2cb] hover:text-[#ff7f00] transition-colors duration-200" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedFile(file)
                          }}
                          className="w-10 h-10 backdrop-blur-sm bg-white/10 border border-white/20 text-[#d7d2cb] hover:border-[#ff7f00]/50 hover:text-[#ff7f00] hover:bg-white/15 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
                          title="View file"
                        >
                          <Eye className="w-4 h-4 text-[#d7d2cb] hover:text-[#ff7f00] transition-colors duration-200" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onFileDelete?.(file.id)
                          }}
                          className="w-10 h-10 bg-red-500/90 text-white hover:bg-red-600/90 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Duration Badge for Audio/Video */}
                      {file.duration && (
                        <div className="absolute bottom-2 right-2">
                          <Badge variant="secondary" className="text-xs">
                            {formatDuration(file.duration)}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="pt-4 px-4 pb-0">
                      <h3 className="font-medium text-[#d7d2cb] truncate text-sm">
                        {file.name}
                      </h3>
                      <div className="flex items-center justify-between mt-3">
                        <Badge 
                          variant="secondary" 
                          className={cn('text-xs hover:bg-opacity-100', getFileTypeColor(file.type))}
                        >
                          {file.type}
                        </Badge>
                        <span className="text-xs text-[#d7d2cb]/60">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-[#d7d2cb]/60 mt-3">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatRelativeTime(file.uploadedAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredFiles.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <HardDrive className="w-8 h-8 text-[#d7d2cb]/60" />
          </div>
          <h3 className="text-lg font-semibold text-[#d7d2cb] mb-2">
            No {filter === 'all' ? '' : filter} files found
          </h3>
          <p className="text-[#d7d2cb]/70">
            {filter === 'all' 
              ? 'Upload your first media file to get started.'
              : `No ${filter} files in your library.`
            }
          </p>
        </div>
      )}

      {/* File Preview Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => {
          setSelectedFile(null)
          setIsRenaming(false)
          setNewFileName('')
        }}
        title={isRenaming ? 'Rename File' : selectedFile?.name}
        size="xl"
      >
        {selectedFile && (
          <div className="space-y-4">
            {/* File Preview */}
            <div className="aspect-video bg-white/5 rounded-lg overflow-hidden">
              {selectedFile.type === 'image' ? (
                <img
                  src={selectedFile.url}
                  alt={selectedFile.name}
                  className="w-full h-full object-contain"
                />
              ) : selectedFile.type === 'video' ? (
                <video
                  src={selectedFile.url}
                  controls
                  className="w-full h-full"
                />
              ) : selectedFile.type === 'audio' ? (
                <div className="w-full h-full flex items-center justify-center">
                  <audio
                    src={selectedFile.url}
                    controls
                    className="w-full max-w-md"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="w-16 h-16 text-[#d7d2cb]/60" />
                </div>
              )}
            </div>

            {/* Rename Input */}
            {isRenaming && (
              <div className="backdrop-blur-md bg-white/5 rounded-lg p-4">
                <label className="block text-sm font-semibold text-[#d7d2cb] mb-2">
                  New File Name
                </label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent"
                  placeholder="Enter new file name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRename()
                    } else if (e.key === 'Escape') {
                      cancelRename()
                    }
                  }}
                />
                <div className="flex justify-end space-x-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelRename}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRename}
                    disabled={!newFileName.trim()}
                  >
                    Rename
                  </Button>
                </div>
              </div>
            )}

            {/* File Details */}
            <div className="backdrop-blur-md bg-white/5 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-base">
                <div>
                  <span className="font-semibold text-[#d7d2cb]">Size:</span>
                  <span className="ml-2 text-[#d7d2cb]">{formatFileSize(selectedFile.size)}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#d7d2cb]">Type:</span>
                  <span className="ml-2 text-[#d7d2cb] capitalize">{selectedFile.type}</span>
                </div>
                <div>
                  <span className="font-semibold text-[#d7d2cb]">Uploaded:</span>
                  <span className="ml-2 text-[#d7d2cb]">{formatRelativeTime(selectedFile.uploadedAt)}</span>
                </div>
                {selectedFile.duration && (
                  <div>
                    <span className="font-semibold text-[#d7d2cb]">Duration:</span>
                    <span className="ml-2 text-[#d7d2cb]">{formatDuration(selectedFile.duration)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onFileDownload?.(selectedFile.id)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              {!isRenaming && (
                <Button
                  variant="outline"
                  onClick={startRename}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Rename
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  onFileDelete?.(selectedFile.id)
                  setSelectedFile(null)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export { MediaGallery }
