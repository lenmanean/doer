'use client'

import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { Card, CardContent } from '@/components/ui/Card'
import { FileUpload } from '@/components/ui/FileUpload'
import { MediaGallery } from '@/components/ui/MediaGallery'
import { MediaGallerySkeleton } from '@/components/ui/LoadingSkeleton'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'

export default function MediaPage() {
  // User authentication and onboarding protection
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  
  // Media-specific state
  const [files, setFiles] = useState<any[]>([])
  const [filesLoading, setFilesLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Fetch user's media files
  useEffect(() => {
    const fetchFiles = async () => {
      if (!user) return
      
      setFilesLoading(true)
      try {
        const { data, error } = await supabase
          .from('media_files')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching files:', error)
        } else {
          // Transform database files to match MediaGallery interface
          const transformedFiles = (data || []).map(file => ({
            id: file.id,
            name: file.file_name,
            type: file.file_type,
            size: file.file_size,
            url: file.file_url,
            uploadedAt: new Date(file.created_at),
            mimeType: file.mime_type,
            thumbnail: file.thumbnail_url
          }))
          setFiles(transformedFiles)
        }
      } catch (error) {
        console.error('Error fetching files:', error)
      } finally {
        setFilesLoading(false)
      }
    }

    fetchFiles()
  }, [user, supabase, refreshKey])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Sidebar 
          user={{ email: 'Loading...' }}
          onSignOut={handleSignOut}
          currentPath="/media"
        />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MediaGallerySkeleton />
        </main>
      </div>
    )
  }

  // User is guaranteed to be authenticated and onboarded at this point

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <Sidebar 
        user={{ email: user.email }}
        onSignOut={handleSignOut}
        currentPath="/media"
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Media Gallery with Integrated Upload */}
        <Card className="relative">
          <CardContent className="p-6">
            {/* Upload Progress Overlay */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-10 flex items-center justify-center rounded-2xl">
                <div className="glass-panel p-6 max-w-sm w-full mx-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-[#ff7f00]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <div className="w-6 h-6 border-2 border-[#ff7f00] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <h3 className="text-lg font-semibold text-[#d7d2cb] mb-2">
                      Uploading Files
                    </h3>
                    <p className="text-[#d7d2cb]/70 mb-4">
                      Please wait while your files are being uploaded...
                    </p>
                    <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                      <div 
                        className="bg-[#ff7f00] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-[#d7d2cb]/60">
                      {uploadProgress}% complete
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* File Upload Component */}
            <div className="mb-6">
              <FileUpload
                onUploadStart={() => {
                  setIsUploading(true)
                  setUploadProgress(0)
                }}
                onUploadProgress={(progress) => {
                  setUploadProgress(progress)
                }}
                onUploadComplete={(uploadedFiles) => {
                  // Transform and add new files to the list
                  const transformedFiles = uploadedFiles.map(file => ({
                    id: file.id,
                    name: file.file_name,
                    type: file.file_type,
                    size: file.file_size,
                    url: file.file_url,
                    uploadedAt: new Date(file.created_at),
                    mimeType: file.mime_type,
                    thumbnail: file.thumbnail_url
                  }))
                  setFiles(prev => [...transformedFiles, ...prev])
                  setRefreshKey(prev => prev + 1)
                  setIsUploading(false)
                  setUploadProgress(0)
                }}
                onUploadError={() => {
                  setIsUploading(false)
                  setUploadProgress(0)
                }}
                maxSize={100 * 1024 * 1024} // 100MB limit
                acceptedTypes={['image/*', 'audio/*', 'video/*', '.pdf', '.doc', '.docx']}
              />
            </div>

            {/* Media Gallery */}
            {filesLoading ? (
              <MediaGallerySkeleton />
            ) : (
              <MediaGallery 
                key={refreshKey}
                files={files}
                onFileSelect={(file) => console.log('Selected file:', file)}
                onFileDelete={async (fileId) => {
                  try {
                    // Delete from database
                    const { error: dbError } = await supabase
                      .from('media_files')
                      .delete()
                      .eq('id', fileId)

                    if (dbError) {
                      console.error('Error deleting file from database:', dbError)
                      return
                    }

                    // Remove from local state
                    setFiles(prev => prev.filter(f => f.id !== fileId))
                    console.log('File deleted:', fileId)
                  } catch (error) {
                    console.error('Error deleting file:', error)
                  }
                }}
                onFileDownload={(fileId) => {
                  const file = files.find(f => f.id === fileId)
                  if (file) {
                    window.open(file.url, '_blank')
                  }
                }}
                onFileRename={async (fileId, newName) => {
                  try {
                    // Update file name in database
                    const { error: dbError } = await supabase
                      .from('media_files')
                      .update({ file_name: newName })
                      .eq('id', fileId)

                    if (dbError) {
                      console.error('Error renaming file in database:', dbError)
                      return
                    }

                    // Update local state
                    setFiles(prev => prev.map(f => 
                      f.id === fileId ? { ...f, name: newName } : f
                    ))
                    console.log('File renamed:', fileId, 'to', newName)
                  } catch (error) {
                    console.error('Error renaming file:', error)
                  }
                }}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
