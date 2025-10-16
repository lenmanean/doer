'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Calendar, ArrowRight } from 'lucide-react'
import { Button } from './Button'

interface PlanTypeSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectAI: () => void
  onSelectManual: () => void
}

export function PlanTypeSelectionModal({
  isOpen,
  onClose,
  onSelectAI,
  onSelectManual
}: PlanTypeSelectionModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[110]"
          />

          {/* Modal Panel */}
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-2xl"
          >
            <div className="bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/20 bg-gradient-to-b from-white/5 to-transparent">
                <div>
                  <h2 className="text-2xl font-bold text-[#d7d2cb]">Choose Plan Type</h2>
                  <p className="text-sm text-[#d7d2cb]/60 mt-1">
                    Select how you'd like to create your goal
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded-lg hover:bg-white/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Manual Plan Option - Now on the left */}
                  <motion.button
                    onClick={onSelectManual}
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="group relative overflow-hidden bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white/30 rounded-xl p-6 text-left transition-all duration-150"
                  >
                    <div className="relative z-10">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center mb-4 group-hover:bg-white/15 transition-all duration-150">
                        <Calendar className="w-6 h-6 text-[#d7d2cb]" />
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-bold text-[#d7d2cb] mb-2 flex items-center gap-2">
                        Manual Plan
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-150" />
                      </h3>

                      {/* Description */}
                      <p className="text-[#d7d2cb]/70 text-sm leading-relaxed mb-4">
                        Take full control by manually creating your own roadmap, milestones, and tasks exactly the way you envision them.
                      </p>

                      {/* Features */}
                      <ul className="space-y-2 text-xs text-[#d7d2cb]/60">
                        <li className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#d7d2cb]/40 mt-1.5 flex-shrink-0" />
                          <span>Complete creative control</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#d7d2cb]/40 mt-1.5 flex-shrink-0" />
                          <span>Custom milestone creation</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#d7d2cb]/40 mt-1.5 flex-shrink-0" />
                          <span>Flexible timeline setup</span>
                        </li>
                      </ul>
                    </div>
                  </motion.button>

                  {/* AI Plan Option - Now on the right */}
                  <motion.button
                    onClick={onSelectAI}
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="group relative overflow-hidden bg-gradient-to-br from-[#ff7f00]/20 via-purple-500/20 to-pink-500/20 hover:from-[#ff7f00]/30 hover:via-purple-500/30 hover:to-pink-500/30 border border-white/20 rounded-xl p-6 text-left transition-all duration-150"
                  >
                    {/* Animated gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#ff7f00]/0 via-purple-500/0 to-pink-500/0 group-hover:from-[#ff7f00]/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-150" />
                    
                    <div className="relative z-10">
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#ff7f00] to-purple-500 flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-[#ff7f00]/50 transition-all duration-150">
                        <Sparkles className="w-6 h-6 text-white" />
                      </div>

                      {/* Title */}
                      <h3 className="text-xl font-bold text-[#d7d2cb] mb-2 flex items-center gap-2">
                        AI Plan
                        <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-150" />
                      </h3>

                      {/* Description */}
                      <p className="text-[#d7d2cb]/70 text-sm leading-relaxed mb-4">
                        Let our intelligent AI analyze your goal and generate a personalized roadmap with milestones and tasks tailored just for you.
                      </p>

                      {/* Features */}
                      <ul className="space-y-2 text-xs text-[#d7d2cb]/60">
                        <li className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-[#ff7f00] mt-1.5 flex-shrink-0" />
                          <span>Smart milestone generation</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
                          <span>Personalized task breakdown</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full bg-pink-500 mt-1.5 flex-shrink-0" />
                          <span>Adaptive timeline planning</span>
                        </li>
                      </ul>
                    </div>
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}


