'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { User, Zap, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImageCropper } from '@/components/ui/ImageCropper'
import { supabase } from '@/lib/supabase/client'

interface UserProfile {
  display_name: string
  bio: string
  avatar_url: string
  share_achievements: boolean
}

export default function CommunityPage() {
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileData, setProfileData] = useState<UserProfile>({
    display_name: '',
    bio: '',
    avatar_url: '',
    share_achievements: true
  })
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [showImageCropper, setShowImageCropper] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile data when modal opens
  useEffect(() => {
    if (showProfileModal && user) {
      loadProfileData()
    }
  }, [showProfileModal, user])

  const loadProfileData = async () => {
    setLoadingProfile(true)
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) throw new Error('Failed to load profile')
      
      const { profile: loadedProfile } = await response.json()
      
      setProfileData({
        display_name: loadedProfile.display_name || '',
        bio: loadedProfile.bio || '',
        avatar_url: loadedProfile.avatar_url || '',
        share_achievements: loadedProfile.share_achievements ?? true
      })
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoadingProfile(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Read file and show cropper
    const reader = new FileReader()
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string)
      setShowImageCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCropComplete = async (croppedImageBlob: Blob) => {
    if (!user) return

    setUploadingImage(true)
    setShowImageCropper(false)

    try {
      // Generate unique filename
      const filename = `${user.id}/${Date.now()}.png`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filename, croppedImageBlob, {
          contentType: 'image/png',
          upsert: true
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filename)

      // Update profile data with new avatar URL
      setProfileData({ ...profileData, avatar_url: urlData.publicUrl })

      console.log('Avatar uploaded successfully:', urlData.publicUrl)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploadingImage(false)
      setSelectedImage(null)
    }
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData)
      })
      
      if (!response.ok) throw new Error('Failed to save profile')
      
      const { profile: savedProfile } = await response.json()
      console.log('Profile saved successfully:', savedProfile)
      
      setShowProfileModal(false)
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile. Please try again.')
    } finally {
      setSavingProfile(false)
    }
  }

  // Show loading state while user data is being fetched
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-[#d7d2cb]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <Sidebar 
        user={profile || { email: user?.email || '' }}
        onSignOut={handleSignOut}
        currentPath="/community"
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Header Section with Profile Button */}
          <FadeInWrapper delay={0.1} direction="up">
            <div className="mb-8 flex items-start justify-between">
              <div>
                <h1 className="text-5xl font-bold tracking-tight text-[#d7d2cb] mb-4">
                  Community
                </h1>
                <p className="text-base leading-relaxed text-[#d7d2cb]/70 max-w-prose">
                  Connect with other achievers, share your progress, and get support on your journey.
                </p>
              </div>
              {/* Profile Button */}
              <motion.button
                onClick={() => setShowProfileModal(true)}
                className="w-12 h-12 bg-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center overflow-hidden"
                whileHover={{ 
                  scale: 1.15,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }}
                whileTap={{ scale: 0.95 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 17 
                }}
              >
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-[#d7d2cb]" />
                )}
              </motion.button>
            </div>
          </FadeInWrapper>

          {/* Main Panels Grid */}
          <FadeInWrapper delay={0.2} direction="up">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Discord Panel */}
              <Card className="bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-blue-500/10 backdrop-blur-md border border-indigo-500/30">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-indigo-200">
                    Join our Discord
                  </CardTitle>
                  <CardDescription className="text-indigo-300/70">
                    Connect with the community in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center">
                  <iframe 
                    src="https://discord.com/widget?id=1426834242603716620&theme=dark" 
                    width="350" 
                    height="500" 
                    style={{ border: 0 }}
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                    className="rounded-lg"
                  />
                </CardContent>
              </Card>

              {/* Dev Log Panel */}
              <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-purple-500/10 backdrop-blur-md border border-purple-500/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="w-6 h-6 text-purple-400" />
                    <CardTitle className="text-2xl font-semibold text-purple-200">
                      Dev. Log
                    </CardTitle>
                  </div>
                  <CardDescription className="text-purple-300/70">
                    Latest updates and patches
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mb-4">
                      <Zap className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#d7d2cb] mb-2">
                      Coming Soon
                    </h3>
                    <p className="text-sm text-[#d7d2cb]/60 text-center">
                      Stay tuned for development updates and new features
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Groups Panel */}
              <Card className="bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-blue-500/10 backdrop-blur-md border border-blue-500/30">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-400" />
                    <CardTitle className="text-2xl font-semibold text-blue-200">
                      Groups
                    </CardTitle>
                  </div>
                  <CardDescription className="text-blue-300/70">
                    Connect with accountability partners
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
                      <Users className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-[#d7d2cb] mb-2">
                      Coming Soon
                    </h3>
                    <p className="text-sm text-[#d7d2cb]/60 text-center">
                      Create or join groups to stay accountable and achieve your goals together
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </FadeInWrapper>
        </StaggeredFadeIn>
      </main>

      {/* Profile Customization Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={() => setShowProfileModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="glass-panel p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#d7d2cb] mb-2">Profile Customization</h2>
                <p className="text-[#d7d2cb]/70">Personalize your profile and preferences</p>
              </div>

              {loadingProfile ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#ff7f00] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Profile Picture */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#d7d2cb] mb-3">Profile Picture</label>
                    <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-white/5 border border-white/20 rounded-full flex items-center justify-center overflow-hidden">
                        {uploadingImage ? (
                          <div className="w-6 h-6 border-2 border-[#d7d2cb] border-t-transparent rounded-full animate-spin" />
                        ) : profileData.avatar_url ? (
                          <img 
                            src={profileData.avatar_url} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-10 h-10 text-[#d7d2cb]/60" />
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                        className="px-4 py-2 bg-white/5 backdrop-blur-md border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingImage ? 'Uploading...' : 'Upload Photo'}
                      </button>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#d7d2cb] mb-2">Display Name</label>
                    <input
                      type="text"
                      value={profileData.display_name}
                      onChange={(e) => setProfileData({ ...profileData, display_name: e.target.value })}
                      placeholder="Enter your name"
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-1 focus:ring-[#ff7f00]"
                    />
                  </div>

                  {/* Bio */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-[#d7d2cb] mb-2">Bio</label>
                    <textarea
                      value={profileData.bio}
                      onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                      placeholder="Tell us about yourself..."
                      rows={4}
                      className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-[#d7d2cb] placeholder-[#d7d2cb]/40 focus:outline-none focus:border-[#ff7f00] focus:ring-1 focus:ring-[#ff7f00] resize-none"
                    />
                  </div>

                  {/* Achievement Sharing Toggle */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/20 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-[#d7d2cb]">Share Achievements</p>
                        <p className="text-xs text-[#d7d2cb]/60">Display your achievements in the community banner</p>
                      </div>
                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => setProfileData({ ...profileData, share_achievements: !profileData.share_achievements })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent ${
                          profileData.share_achievements ? 'bg-blue-500' : 'bg-white/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                            profileData.share_achievements ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowProfileModal(false)}
                      disabled={savingProfile}
                      className="flex-1 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="flex-1 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/30 rounded-lg text-[#d7d2cb] hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingProfile ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#d7d2cb] border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Cropper Modal */}
      <AnimatePresence>
        {showImageCropper && selectedImage && (
          <ImageCropper
            image={selectedImage}
            onCropComplete={handleCropComplete}
            onCancel={() => {
              setShowImageCropper(false)
              setSelectedImage(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

