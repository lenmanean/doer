'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users, ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function DiscordJoinWidget() {
  const [isHovered, setIsHovered] = useState(false)

  const handleJoinDiscord = () => {
    window.open('https://discord.gg/JfPXMjCzbN', '_blank')
  }

  return (
    <motion.div
      className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleJoinDiscord}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
        <Users className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-[#d7d2cb]">Join Discord Community</p>
          <motion.div
            animate={{ x: isHovered ? 2 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ExternalLink className="w-4 h-4 text-indigo-400" />
          </motion.div>
        </div>
        <p className="text-xs text-[#d7d2cb]/60 mb-2">
          Connect with fellow achievers sharing their goals and progress
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3 text-indigo-400" />
            <span className="text-xs text-[#d7d2cb]/60">Active discussions</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
