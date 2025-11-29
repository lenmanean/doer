'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Target, Archive, Trash2, Check, Link2 } from 'lucide-react'
import { formatDateForDisplay, parseDateFromDB } from '@/lib/date-utils'

interface PlanCardProps {
  plan: {
    id: string
    goal_text: string
    status: string
    start_date: string
    end_date?: string
    plan_type?: 'ai' | 'manual' | 'integration'
    integration_metadata?: {
      connection_id?: string
      provider?: 'google' | 'outlook' | 'apple'
      calendar_ids?: string[]
      calendar_names?: string[]
    }
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
  const isIntegration = plan.plan_type === 'integration'
  const [showConfirmSwitch, setShowConfirmSwitch] = useState(false)

  // Get provider name for integration plans
  const getProviderName = () => {
    if (!isIntegration || !plan.integration_metadata?.provider) return null
    const provider = plan.integration_metadata.provider
    return provider === 'google' ? 'Google Calendar'
      : provider === 'outlook' ? 'Microsoft Outlook'
      : provider === 'apple' ? 'Apple Calendar'
      : 'Calendar'
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`p-4 rounded-lg border transition-all duration-200 backdrop-blur-md relative ${
        isActive
          ? 'bg-[var(--input)]/50 border-[var(--border)]/50 shadow-lg'
          : isArchived
          ? 'bg-[var(--input)]/10 border-[var(--border)]/30 opacity-60'
          : 'bg-[var(--input)]/30 border-[var(--border)]/40 hover:border-[var(--border)]/50 hover:bg-[var(--input)]/40 cursor-pointer'
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
            <h3 className="text-sm font-medium text-[var(--foreground)] truncate">
              {goalTitle}
            </h3>
            {isIntegration && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                Integration
              </span>
            )}
            {isPaused && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]/10 text-[var(--muted-foreground)] border border-[var(--muted)]/20">
                Inactive
              </span>
            )}
            {isArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--muted)]/10 text-[var(--muted-foreground)] border border-[var(--muted)]/20">
                Archived
              </span>
            )}
          </div>
          
          {isIntegration && getProviderName() && (
            <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
              {getProviderName()} integration plan
              {plan.integration_metadata?.calendar_names && plan.integration_metadata.calendar_names.length > 0 && (
                <span className="ml-1">
                  • {plan.integration_metadata.calendar_names.length} calendar{plan.integration_metadata.calendar_names.length !== 1 ? 's' : ''}
                </span>
              )}
            </p>
          )}
          {!isIntegration && plan.summary_data?.goal_summary && (
            <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
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
      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)] mb-3">
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
        <div className="flex items-center gap-4 mb-3 text-xs text-[var(--muted-foreground)]">
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
        <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
          {onArchive && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onArchive(plan.id)
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--input)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]"
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
          className="absolute bottom-3 right-3 p-1.5 rounded-lg bg-[var(--input)] text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border border-[var(--border)] hover:border-red-500/30 opacity-70 hover:opacity-100"
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
            className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/70 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-4 w-[90%] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-[var(--foreground)] mb-4 text-center">
                Switch to this plan?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowConfirmSwitch(false)
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--input)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowConfirmSwitch(false)
                    if (onSwitch) onSwitch(plan.id)
                  }}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 transition-colors"
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

