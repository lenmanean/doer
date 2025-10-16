'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { useRouter } from 'next/navigation'
import { PlanCard } from './PlanCard'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'
import { PlanTypeSelectionModal } from './PlanTypeSelectionModal'

interface Plan {
  id: string
  user_id: string
  goal_text: string
  status: string
  start_date: string
  end_date?: string
  summary_data?: {
    goal_title?: string
    goal_summary?: string
  }
  created_at: string
  archived_at?: string
  milestone_count?: number
  task_count?: number
}

interface SwitchPlanModalProps {
  isOpen: boolean
  onClose: () => void
  hasActivePlan: boolean
  currentPlanTitle?: string
  onPlanChanged?: () => void
}

export function SwitchPlanModal({
  isOpen,
  onClose,
  hasActivePlan,
  currentPlanTitle,
  onPlanChanged
}: SwitchPlanModalProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const [showPlanTypeModal, setShowPlanTypeModal] = useState(false)

  // Fetch plans when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPlans()
    }
  }, [isOpen])

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/plans/list')
      if (!response.ok) {
        throw new Error('Failed to fetch plans')
      }
      const data = await response.json()
      setPlans(data.plans || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (planId: string) => {
    setSwitching(planId)
    try {
      const response = await fetch('/api/plans/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId })
      })
      
      if (!response.ok) {
        throw new Error('Failed to switch plan')
      }
      
      // Refresh plans list
      await fetchPlans()
      
      // Notify parent component to refresh
      onPlanChanged?.()
      
      // Close modal after successful switch
      setTimeout(() => {
        onClose()
      }, 500)
    } catch (error) {
      console.error('Error switching plan:', error)
      alert('Failed to switch plan. Please try again.')
    } finally {
      setSwitching(null)
    }
  }

  const handleArchive = async (planId: string) => {
    try {
      const response = await fetch('/api/plans/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId })
      })
      
      if (!response.ok) {
        throw new Error('Failed to archive plan')
      }
      
      const result = await response.json()
      
      // If we archived the active plan, warn user
      if (result.was_active) {
        alert('You archived your active plan. Please select a new active plan or create one.')
      }
      
      // Refresh plans list
      await fetchPlans()
      
      // Notify parent component
      onPlanChanged?.()
    } catch (error) {
      console.error('Error archiving plan:', error)
      alert('Failed to archive plan. Please try again.')
    }
  }

  const handleDeleteClick = (planId: string) => {
    // Find the plan object from the plans array
    const plan = plans.find(p => p.id === planId)
    if (plan) {
      setPlanToDelete(plan)
      setDeleteModalOpen(true)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!planToDelete) {
      console.error('No plan to delete')
      return
    }
    
    console.log('Deleting plan:', planToDelete.id)
    
    setDeleting(true)
    try {
      // Use the dedicated plan deletion endpoint
      const response = await fetch('/api/plans/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planToDelete.id })
      })
      
      console.log('Delete response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete plan')
      }
      
      const result = await response.json()
      
      // Close delete modal
      setDeleteModalOpen(false)
      setPlanToDelete(null)
      
      // If we deleted the active plan, warn user
      if (result.was_active) {
        alert('You deleted your active plan. Please select a new active plan or create one.')
      }
      
      // Refresh plans list
      await fetchPlans()
      
      // Notify parent component
      onPlanChanged?.()
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete plan. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleSelectAIPlan = () => {
    setShowPlanTypeModal(false)
    router.push('/onboarding')
    onClose()
  }

  const handleSelectManualPlan = () => {
    setShowPlanTypeModal(false)
    router.push('/onboarding/manual')
    onClose()
  }

  // Categorize plans
  const activePlan = plans.find(p => p.status === 'active')
  const pausedPlans = plans.filter(p => p.status === 'paused')
  const archivedPlans = plans.filter(p => p.status === 'archived')

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100]"
            />

            {/* Modal Panel */}
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              <div className="bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/20 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/20 flex-shrink-0 bg-gradient-to-b from-white/5 to-transparent">
                  <div>
                    <h2 className="text-2xl font-bold text-[#d7d2cb]">Goals</h2>
                    <p className="text-sm text-[#d7d2cb]/60 mt-1">
                      Manage and switch between your goals
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] transition-colors p-2 rounded-lg hover:bg-white/5"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-[#ff7f00] animate-spin" />
                    </div>
                  ) : plans.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-[#d7d2cb]/60 mb-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                          <Plus className="w-8 h-8 text-[#d7d2cb]/40" />
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-[#d7d2cb] mb-2">
                        No Plans Yet
                      </h3>
                      <p className="text-sm text-[#d7d2cb]/60 mb-6">
                        Create your first goal to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Active Plan */}
                      {activePlan && (
                        <PlanCard
                          plan={activePlan}
                          isActive={true}
                          showActions={false}
                        />
                      )}

                      {/* Separator between active and other plans */}
                      {activePlan && pausedPlans.length > 0 && (
                        <div className="border-t border-white/10 my-6" />
                      )}

                      {/* Other Plans Section */}
                      {pausedPlans.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-[#d7d2cb]/60 uppercase tracking-wider mb-3">
                            Other Plans
                          </h3>
                          <div className="space-y-3">
                            {pausedPlans.map(plan => (
                              <PlanCard
                                key={plan.id}
                                plan={plan}
                                isActive={false}
                                onSwitch={handleSwitch}
                                onArchive={handleArchive}
                                onDelete={handleDeleteClick}
                                showActions={switching !== plan.id}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Archived Plans Section - Collapsible */}
                      {archivedPlans.length > 0 && (
                        <div>
                          <button
                            onClick={() => setShowArchived(!showArchived)}
                            className="flex items-center justify-between w-full text-xs font-semibold text-[#d7d2cb]/60 uppercase tracking-wider mb-3 hover:text-[#d7d2cb]/80 transition-colors"
                          >
                            <span>Archived Plans ({archivedPlans.length})</span>
                            {showArchived ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          {showArchived && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-3"
                            >
                              {archivedPlans.map(plan => (
                                <PlanCard
                                  key={plan.id}
                                  plan={plan}
                                  isActive={false}
                                  onDelete={handleDeleteClick}
                                  showActions={true}
                                />
                              ))}
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer - Add New Goal Button */}
                <div className="p-6 border-t border-white/20 flex-shrink-0 bg-gradient-to-t from-white/5 to-transparent backdrop-blur-sm">
                  <Button
                    onClick={() => setShowPlanTypeModal(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Goal
                  </Button>
                </div>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false)
          setPlanToDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Plan"
        description={`Are you sure you want to delete "${planToDelete?.summary_data?.goal_title || planToDelete?.goal_text}"? This will permanently remove all tasks, milestones, and progress data for this plan.`}
        confirmText="Delete Plan"
        isDeleting={deleting}
      />

      {/* Plan Type Selection Modal */}
      <PlanTypeSelectionModal
        isOpen={showPlanTypeModal}
        onClose={() => setShowPlanTypeModal(false)}
        onSelectAI={handleSelectAIPlan}
        onSelectManual={handleSelectManualPlan}
      />
    </>
  )
}

