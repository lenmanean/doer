'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/ui/Sidebar'
import { useOnboardingProtection } from '@/lib/useOnboardingProtection'
import { useGlobalPendingReschedules } from '@/hooks/useGlobalPendingReschedules'
import { FadeInWrapper, StaggeredFadeIn } from '@/components/ui/FadeInWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Inbox } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CommunityPage() {
  const { user, profile, loading, handleSignOut } = useOnboardingProtection()
  const [showInboxModal, setShowInboxModal] = useState(false)
  const { hasPending: hasPendingReschedules } = useGlobalPendingReschedules(user?.id || null)

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
        hasPendingReschedules={hasPendingReschedules}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StaggeredFadeIn>
          {/* Header Section with Inbox Button */}
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
              {/* Inbox Button */}
              <motion.button
                onClick={() => setShowInboxModal(true)}
                className="w-12 h-12 bg-white/5 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center"
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
                <Inbox className="w-6 h-6 text-[#d7d2cb]" />
              </motion.button>
            </div>
          </FadeInWrapper>

          {/* Main Panels Grid */}
          <FadeInWrapper delay={0.2} direction="up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Discord Panel */}
              <Card className="bg-white/5 backdrop-blur-md border border-white/20">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-[#d7d2cb]">
                    Join our Discord
                  </CardTitle>
                  <CardDescription className="text-[#d7d2cb]/70">
                    Connect with the community in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center items-center">
                  <iframe 
                    src="https://discord.com/widget?id=1426834242603716620&theme=dark" 
                    width="280" 
                    height="400" 
                    style={{ border: 0 }}
                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                    className="rounded-lg"
                  />
                </CardContent>
              </Card>

              {/* Release Notes Panel */}
              <Card className="bg-white/5 backdrop-blur-md border border-white/20">
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold text-[#d7d2cb]">
                    Release Notes
                  </CardTitle>
                  <CardDescription className="text-[#d7d2cb]/70">
                    Latest updates and patches
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-16">
                    <h3 className="text-xl font-semibold text-[#d7d2cb] mb-2">
                      Coming Soon
                    </h3>
                    <p className="text-sm text-[#d7d2cb]/60 text-center">
                      Stay tuned for release updates and new features
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </FadeInWrapper>
        </StaggeredFadeIn>
      </main>

      {/* Inbox Modal */}
      <AnimatePresence>
        {showInboxModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={() => setShowInboxModal(false)}
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
                <h2 className="text-2xl font-bold text-[#d7d2cb] mb-2">Inbox</h2>
                <p className="text-[#d7d2cb]/70">Your messages and notifications</p>
              </div>

              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-white/5 border border-white/20 rounded-full flex items-center justify-center mb-4">
                  <Inbox className="w-8 h-8 text-[#d7d2cb]/60" />
                </div>
                <h3 className="text-xl font-semibold text-[#d7d2cb] mb-2">
                  Coming Soon
                </h3>
                <p className="text-sm text-[#d7d2cb]/60 text-center mb-6">
                  Inbox functionality will be available with multi-user support
                </p>
                <button
                  onClick={() => setShowInboxModal(false)}
                  className="px-4 py-2 bg-white/5 backdrop-blur-md border border-white/20 rounded-lg text-[#d7d2cb] hover:bg-white/10 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

