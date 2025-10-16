'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Target, Archive, Trash2, Check } from 'lucide-react'
import { formatDateForDisplay, parseDateFromDB } from '@/lib/date-utils'

interface PlanCardProps {
  plan: {
    id: string
    goal_text: string
    status: string
    start_date: string
    end_date?: string
    summary_data?: {
      goal_title?: string
      goal_summary?: string
    }
    milestone_count?: number
    task_count?: number
    archived_at?: string
  }
  isActive: boolean
  onSwitch?: (planId: string) => void
  onArchive?: (planId: string) => void
  onDelete?: (planId: string) => void
  showActions?: boolean
}

export function PlanCard({
  plan,
  isActive,
  onSwitch,
  onArchive,
  onDelete,
  showActions = true
}: PlanCardProps) {
  const goalTitle = plan.summary_data?.goal_title || plan.goal_text
  const isArchived = plan.status === 'archived'
  const isPaused = plan.status === 'paused'
  const [showConfirmSwitch, setShowConfirmSwitch] = useState(false)
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-4 rounded-lg border transition-all duration-200 backdrop-blur-md relative ${
        isActive
          ? 'bg-white/10 border-white/30 shadow-lg'
          : isArchived
          ? 'bg-white/[0.02] border-white/10 opacity-60'
          : 'bg-white/5 border-white/20 hover:border-white/30 hover:bg-white/[0.08] cursor-pointer'
      }`}
      onClick={() => {
        if (!isActive && !isArchived && onSwitch) {
          setShowConfirmSwitch(true)
        }
      }}
    >
      {/* Card Content - blur when confirmation is shown */}
      <div className={`transition-all duration-300 ${showConfirmSwitch ? 'blur-[2px]' : ''}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-3">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-[#d7d2cb] truncate">
              {goalTitle}
            </h3>
            {isPaused && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                Inactive
              </span>
            )}
            {isArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                Archived
              </span>
            )}
          </div>
          
          {plan.summary_data?.goal_summary && (
            <p className="text-xs text-[#d7d2cb]/50 line-clamp-2">
              {plan.summary_data.goal_summary}
            </p>
          )}
        </div>
        
        {/* Status indicator dot - right side, vertically centered */}
        <div className="flex items-center h-full">
          {isActive ? (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          ) : !isArchived && (
            <div className="w-2 h-2 rounded-full bg-gray-500/60" />
          )}
        </div>
      </div>

      {/* Date Range */}
      <div className="flex items-center gap-3 text-xs text-[#d7d2cb]/60 mb-3">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>
            {formatDateForDisplay(parseDateFromDB(plan.start_date), {
              month: 'short',
              day: 'numeric'
            })}
          </span>
        </div>
        {plan.end_date && (
          <>
            <span>→</span>
            <span>
              {formatDateForDisplay(parseDateFromDB(plan.end_date), {
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </>
        )}
      </div>

      {/* Stats */}
      {(plan.milestone_count !== undefined || plan.task_count !== undefined) && (
        <div className="flex items-center gap-4 mb-3 text-xs text-[#d7d2cb]/50">
          {plan.milestone_count !== undefined && (
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>{plan.milestone_count} milestones</span>
            </div>
          )}
          {plan.task_count !== undefined && (
            <div className="flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{plan.task_count} tasks</span>
            </div>
          )}
        </div>
      )}

      {/* Actions - Only for archived plans */}
      {showActions && !isActive && isArchived && (
        <div className="flex items-center gap-2 pt-3 border-t border-white/10">
          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onArchive(plan.id)
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-[#d7d2cb]/70 hover:bg-white/10 hover:text-[#d7d2cb] transition-colors border border-white/10"
              title="Archive plan"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
      </div>

      {/* Delete Button - Bottom Right Corner for all plans */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(plan.id)
          }}
          className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-white/5 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border border-white/10 hover:border-red-500/30 opacity-70 hover:opacity-100"
          title="Delete plan"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Confirmation Popup for Switching */}
      <AnimatePresence>
        {showConfirmSwitch && !isActive && !isArchived && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0a0a0a] border border-white/20 rounded-lg p-4 w-[90%] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-[#d7d2cb] mb-4 text-center">
                Switch to this plan?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowConfirmSwitch(false)
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-[#d7d2cb]/70 hover:bg-white/10 hover:text-[#d7d2cb] transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowConfirmSwitch(false)
                    if (onSwitch) onSwitch(plan.id)
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#ff7f00] text-white hover:bg-[#e67300] transition-colors"
                >
                  Switch
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

