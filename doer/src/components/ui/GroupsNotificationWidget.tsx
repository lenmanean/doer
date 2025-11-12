'use client'

import { motion } from 'framer-motion'
import { Users, Plus } from 'lucide-react'

export default function GroupsNotificationWidget() {
  const handleViewGroups = () => {
    // Navigate to groups page or open in new tab
    window.open('/community', '_blank')
  }

  return (
    <motion.div
      className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
        <Users className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-[#d7d2cb]">Groups</p>
        </div>
        <p className="text-xs text-[#d7d2cb]/60 mb-2">
          Join groups and collaborate with like-minded achievers
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Plus className="w-3 h-3 text-blue-400" />
            <span className="text-xs text-blue-400">No groups yet</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
