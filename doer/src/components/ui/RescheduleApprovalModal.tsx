'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Clock, ArrowRight, Check, X, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import type { RescheduleProposal } from '@/lib/types'
import { formatDateForDisplay } from '@/lib/date-utils'

interface RescheduleApprovalModalProps {
  isOpen: boolean
  onClose: () => void
  onDismiss?: (proposalIds: string[]) => void
  proposals: RescheduleProposal[]
  onAccept: (proposalIds: string[]) => Promise<void>
  onReject: (proposalIds: string[]) => Promise<void>
  onMarkComplete?: (proposalIds: string[]) => Promise<void>
  planId?: string | null
}

export function RescheduleApprovalModal({
  isOpen,
  onClose,
  onDismiss,
  proposals,
  onAccept,
  onReject,
  onMarkComplete,
  planId
}: RescheduleApprovalModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [actionType, setActionType] = useState<'accept' | 'reject' | 'complete' | null>(null)
  const [processingProposalId, setProcessingProposalId] = useState<string | null>(null)

  const handleDismiss = () => {
    if (onDismiss) {
      const allProposalIds = proposals.map(p => p.id)
      onDismiss(allProposalIds)
    }
    onClose()
  }

  const handleAcceptAll = async () => {
    const allIds = proposals.map(p => p.id)
    await handleAction(allIds, 'accept')
    onClose()
  }

  const handleRejectAll = async () => {
    const allIds = proposals.map(p => p.id)
    await handleAction(allIds, 'reject')
    onClose()
  }

  const handleAction = async (
    proposalIds: string[],
    action: 'accept' | 'reject' | 'complete',
    singleProposalId?: string
  ) => {
    if (proposalIds.length === 0) return

    setIsProcessing(true)
    setActionType(action)
    if (singleProposalId) {
      setProcessingProposalId(singleProposalId)
    }

    try {
      if (action === 'accept') {
        await onAccept(proposalIds)
      } else if (action === 'reject') {
        await onReject(proposalIds)
      } else if (action === 'complete' && onMarkComplete) {
        await onMarkComplete(proposalIds)
      }
    } catch (error) {
      console.error(`Error ${action}ing proposals:`, error)
    } finally {
      setIsProcessing(false)
      setActionType(null)
      setProcessingProposalId(null)
    }
  }

  const handleMarkComplete = async (proposalId: string) => {
    await handleAction([proposalId], 'complete', proposalId)
  }

  const formatTimeString = (time: string) => {
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const minute = parseInt(minutes)
    if (hour === 0) return `12:${minutes.toString().padStart(2, '0')} AM`
    if (hour === 12) return `12:${minutes.toString().padStart(2, '0')} PM`
    if (hour < 12) return `${hour}:${minutes.toString().padStart(2, '0')} AM`
    return `${hour - 12}:${minutes.toString().padStart(2, '0')} PM`
  }

  const getPriorityColor = (priority?: number) => {
    switch (priority) {
      case 1: return 'text-red-400'
      case 2: return 'text-orange-400'
      case 3: return 'text-yellow-400'
      case 4: return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getPriorityLabel = (priority?: number) => {
    switch (priority) {
      case 1: return 'Critical'
      case 2: return 'High'
      case 3: return 'Medium'
      case 4: return 'Low'
      default: return 'Unknown'
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[150] flex items-center justify-center p-4 overflow-y-auto"
          onClick={handleDismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="glass-panel p-6 max-w-5xl w-full mx-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/5 border border-white/20 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-[#d7d2cb]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#d7d2cb]">
                    Reschedule Approval Required
                  </h2>
                  <p className="text-[#d7d2cb]/70 mt-1">
                    {proposals.length} task{proposals.length !== 1 ? 's' : ''} need{proposals.length === 1 ? 's' : ''} rescheduling
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-1"
                disabled={isProcessing}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#d7d2cb]/60 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[#d7d2cb] font-medium mb-1">
                    Your schedule has pending changes
                  </p>
                  <p className="text-[#d7d2cb]/60 text-sm">
                    These tasks passed their scheduled time without completion. Review the proposed new times and accept or reject each rescheduling.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {proposals.map((proposal, index) => {
                const isProcessingThis = isProcessing && processingProposalId === proposal.id
                const isProcessingAny = isProcessing && !processingProposalId

                return (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border border-white/10 bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
                  >
                    {onMarkComplete && (
                      <button
                        onClick={() => handleMarkComplete(proposal.id)}
                        disabled={isProcessingThis || isProcessingAny}
                        className="text-xs text-[#d7d2cb]/60 hover:text-green-400 transition-colors mb-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isProcessingThis && actionType === 'complete' ? (
                          <>
                            <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            <span>Marking complete...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>I already completed this</span>
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-semibold text-[#d7d2cb]">
                            {proposal.task_name || 'Unknown Task'}
                          </h3>
                          {proposal.task_priority && (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${getPriorityColor(proposal.task_priority)} bg-white/5`}>
                              {getPriorityLabel(proposal.task_priority)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-[#d7d2cb]/60 text-xs">From:</span>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#d7d2cb]/60" />
                              <span className="text-[#d7d2cb]">{formatDateForDisplay(new Date(proposal.original_date))}</span>
                              {proposal.original_start_time && (
                                <span className="text-[#d7d2cb]/70">
                                  {formatTimeString(proposal.original_start_time)}
                                </span>
                              )}
                            </div>
                          </div>

                          <ArrowRight className="w-4 h-4 text-[#d7d2cb]/40 flex-shrink-0" />

                          <div className="flex items-center gap-2">
                            <span className="text-[#d7d2cb]/60 text-xs">To:</span>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#d7d2cb]/60" />
                              <span className="text-[#d7d2cb]">{formatDateForDisplay(new Date(proposal.proposed_date))}</span>
                              {proposal.proposed_start_time && (
                                <span className="text-[#d7d2cb]/70">
                                  {formatTimeString(proposal.proposed_start_time)}
                                </span>
                              )}
                            </div>
                          </div>

                          {proposal.task_duration_minutes && (
                            <span className="text-xs text-[#d7d2cb]/50 ml-auto">
                              {Math.floor(proposal.task_duration_minutes / 60)}h {proposal.task_duration_minutes % 60}m
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAction([proposal.id], 'accept', proposal.id)}
                          disabled={isProcessingThis || isProcessingAny}
                          className="px-4 py-2 bg-[#ff7f00] hover:bg-[#ff8c1a] text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isProcessingThis && actionType === 'accept' ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>Accepting...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              <span>Accept</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleAction([proposal.id], 'reject', proposal.id)}
                          disabled={isProcessingThis || isProcessingAny}
                          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 text-[#d7d2cb] rounded-lg transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isProcessingThis && actionType === 'reject' ? (
                            <>
                              <div className="w-4 h-4 border-2 border-[#d7d2cb] border-t-transparent rounded-full animate-spin" />
                              <span>Rejecting...</span>
                            </>
                          ) : (
                            <>
                              <X className="w-4 h-4" />
                              <span>Reject</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <p className="text-xs text-[#d7d2cb]/50">
                Rejected tasks will remain in their original positions but marked as overdue.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRejectAll}
                  disabled={isProcessing || proposals.length === 0}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/20 text-[#d7d2cb] rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <X className="w-3.5 h-3.5" />
                  Reject All
                </button>
                <button
                  onClick={handleAcceptAll}
                  disabled={isProcessing || proposals.length === 0}
                  className="px-3 py-1.5 bg-[#ff7f00] hover:bg-[#ff8c1a] text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept All
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}



