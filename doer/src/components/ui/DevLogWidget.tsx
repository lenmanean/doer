'use client'

import { motion } from 'framer-motion'
import { FileText, Plus } from 'lucide-react'

export default function DevLogWidget() {
  const handleCreateLog = () => {
    // Navigate to create dev log or open in new tab
    window.open('/dev-log', '_blank')
  }

  return (
    <motion.div
      className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-medium text-[#d7d2cb]">Dev Log</p>
        </div>
        <p className="text-xs text-[#d7d2cb]/60 mb-2">
          Share updates and progress with the community
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Plus className="w-3 h-3 text-purple-400" />
            <span className="text-xs text-purple-400">No entries yet</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
