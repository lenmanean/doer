'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'
import { AlertTriangle } from 'lucide-react'
import { formatDateForDB } from '@/lib/date-utils'

export function TaskEditModal({task, onSave, onDelete, onCancel, isCompleted}: {
  task: any,
  onSave: (updates: any) => void,
  onDelete: () => void,
  onCancel: () => void,
  isCompleted: boolean
}) {
  const [name, setName] = useState(task.name)
  const [scheduledDate, setScheduledDate] = useState(task.scheduled_date || task.date)
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div 
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4">Edit Task</h3>
        
        {isCompleted && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-500">
              This task is marked as completed. Changes will not affect completion status.
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">Task Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">Scheduled Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={onDelete} variant="outline" className="text-red-400 hover:bg-red-500/10">Delete</Button>
            <Button onClick={() => onSave({name, scheduled_date: scheduledDate})} className="flex-1">Save</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function MilestoneEditModal({milestone, onSave, onDelete, onCancel}: {
  milestone: any,
  onSave: (updates: any) => void,
  onDelete: () => void,
  onCancel: () => void
}) {
  const [name, setName] = useState(milestone.title)
  const [description, setDescription] = useState(milestone.description || '')
  const [targetDate, setTargetDate] = useState(formatDateForDB(milestone.estimated_date))
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div 
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4">Edit Milestone</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">Milestone Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-[#d7d2cb] mb-2 block">Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
            <Button onClick={onDelete} variant="outline" className="text-red-400 hover:bg-red-500/10">Delete</Button>
            <Button onClick={() => onSave({title: name, description, target_date: targetDate})} className="flex-1">Save</Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export function DateEditModal({dateType, currentDate, onSave, onCancel}: {
  dateType: 'start' | 'end',
  currentDate: string,
  onSave: (newDate: string) => void,
  onCancel: () => void
}) {
  const [tempDate, setTempDate] = useState(currentDate)
  
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={onCancel}
    >
      <motion.div 
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-[#0a0a0a] border border-white/20 rounded-xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-semibold text-[#d7d2cb] mb-4">
          Edit {dateType === 'start' ? 'Start' : 'End'} Date
        </h3>
        <input 
          type="date"
          value={tempDate}
          onChange={(e) => setTempDate(e.target.value)}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex gap-3 mt-4">
          <Button onClick={onCancel} variant="outline" className="flex-1">Cancel</Button>
          <Button onClick={() => onSave(tempDate)} className="flex-1">Save</Button>
        </div>
      </motion.div>
    </motion.div>
  )
}




