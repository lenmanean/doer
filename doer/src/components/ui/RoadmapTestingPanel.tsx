'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Target, Clock, Settings, CheckCircle } from 'lucide-react'
import { Button } from './Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import { cn } from '@/lib/utils'

interface RoadmapTestingPanelProps {
  onDeadlineChange: (deadline: string) => void
  onStartDateChange: (startDate: string) => void
  onGenerateMilestones: () => void
  testData: TestData
  className?: string
}

interface TestData {
  deadline: string
  startDate: string
}

const RoadmapTestingPanel = ({ onDeadlineChange, onStartDateChange, onGenerateMilestones, testData, className }: RoadmapTestingPanelProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleDeadlineChange = (deadline: string) => {
    onDeadlineChange(deadline)
  }

  const handleStartDateChange = (startDate: string) => {
    onStartDateChange(startDate)
  }

  const handleGenerateMilestones = () => {
    onGenerateMilestones()
  }


  return (
    <div className={cn('fixed bottom-4 right-4 z-50', className)}>
      {/* Toggle Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-[#ff7f00] hover:bg-[#ff7f00]/90 shadow-lg"
          size="icon"
        >
          <Settings className="w-6 h-6 text-white" />
        </Button>
      </motion.div>

      {/* Testing Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ 
          opacity: isOpen ? 1 : 0, 
          y: isOpen ? 0 : 20, 
          scale: isOpen ? 1 : 0.95 
        }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'absolute bottom-16 right-0 w-80 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl backdrop-blur-md',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <Card className="border-0 bg-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-[#d7d2cb] flex items-center gap-2">
              <Target className="w-5 h-5 text-[#ff7f00]" />
              Roadmap Testing Panel
            </CardTitle>
            <CardDescription className="text-[#d7d2cb]/70">
              Simulate roadmap generator output
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Start Date Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#d7d2cb] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#ff7f00]" />
                Start Date
              </label>
              <input
                type="date"
                value={testData.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent"
              />
            </div>

            {/* Deadline Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#d7d2cb] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#ff7f00]" />
                Goal Deadline
              </label>
              <input
                type="date"
                value={testData.deadline}
                onChange={(e) => handleDeadlineChange(e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-[#d7d2cb] placeholder:text-[#d7d2cb]/50 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>


            {/* Generate Milestones Button */}
            <Button
              onClick={handleGenerateMilestones}
              disabled={!testData.startDate || !testData.deadline}
              className="w-full bg-[#ff7f00] hover:bg-[#ff7f00]/90 text-white font-medium"
            >
              Generate
            </Button>

          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export { RoadmapTestingPanel }
export type { TestData }
