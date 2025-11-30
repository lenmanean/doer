'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface SyncWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  eventCount: number
  isSyncing?: boolean
}

export function SyncWarningModal({
  isOpen,
  onClose,
  onConfirm,
  eventCount,
  isSyncing = false
}: SyncWarningModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-[120] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="glass-panel p-6 max-w-md w-full mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors"
              disabled={isSyncing}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon */}
            <div className="w-14 h-14 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-orange-400" />
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-[#d7d2cb] mb-3 text-center">
              Large Calendar Detected
            </h3>

            {/* Description */}
            <p className="text-[#d7d2cb]/70 mb-3 text-center leading-relaxed">
              Your calendar contains approximately <strong className="text-[#d7d2cb]">{eventCount.toLocaleString()}</strong> events. 
              A full sync may take a few moments to complete.
            </p>

            {/* Info Text */}
            <p className="text-sm text-orange-400/80 font-medium text-center mb-6">
              Do you want to continue with the sync?
            </p>

            {/* Buttons */}
            <div className="flex gap-3">
              <motion.button
                className="flex-1 h-11 px-4 py-2 text-[#d7d2cb] bg-transparent border border-white/20 rounded-lg hover:bg-white/10 hover:border-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onClose}
                disabled={isSyncing}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                Cancel
              </motion.button>
              <motion.button
                className="flex-1 h-11 px-4 py-2 text-white bg-[#ff7f00] border border-[#ff7f00] rounded-lg hover:bg-[#ff8f20] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                onClick={onConfirm}
                disabled={isSyncing}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              >
                {isSyncing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Syncing...
                  </>
                ) : (
                  'Continue'
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

