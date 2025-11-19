'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { ActivityHeatmap, ActivityHeatmapData } from './ActivityHeatmap'
import { TrendChart, TrendChartData } from './TrendChart'
import { BarChart, BarChartData } from './BarChart'
import { cn } from '@/lib/utils'

interface AnalyticsTabsProps {
  activityData: ActivityHeatmapData[]
  completionTrend: TrendChartData[]
  productivityPatterns: BarChartData[]
  reschedulingAnalysis: BarChartData[]
  onDayClick?: (date: string) => void
  onTimeRangeChange?: (range: '7d' | '30d' | '90d' | 'all') => void
}

type TabType = 'heatmap' | 'trend' | 'productivity' | 'rescheduling'

const tabs: { id: TabType; label: string; description: string }[] = [
  {
    id: 'heatmap',
    label: 'Activity Heatmap',
    description: 'Visualize your daily activity patterns and task completion frequency'
  },
  {
    id: 'trend',
    label: 'Completion Trend',
    description: 'Track your completion rate over time to identify patterns and improvements'
  },
  {
    id: 'productivity',
    label: 'Productivity Patterns',
    description: 'Discover which days of the week you\'re most productive and efficient'
  },
  {
    id: 'rescheduling',
    label: 'Rescheduling Analysis',
    description: 'Analyze task rescheduling patterns to improve time management'
  }
]

export function AnalyticsTabs({
  activityData,
  completionTrend,
  productivityPatterns,
  reschedulingAnalysis,
  onDayClick,
  onTimeRangeChange
}: AnalyticsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('heatmap')

  // Debug: Log when component renders
  console.log('AnalyticsTabs rendering with activeTab:', activeTab)

  return (
    <Card className="bg-white/5 border-2 border-[#ff7f00] mb-8">
      {/* Tabs Header - Make it very visible */}
      <div className="border-b-2 border-white/30 bg-white/10 py-2">
        <div className="flex items-center gap-1 px-6 pt-4 pb-2 overflow-x-auto">
          <div className="text-xs text-[#ff7f00] font-bold mr-4">TABS COMPONENT ACTIVE</div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative px-6 py-3 text-sm font-medium transition-all whitespace-nowrap rounded-t-lg',
                activeTab === tab.id
                  ? 'text-[#d7d2cb] font-semibold bg-white/10'
                  : 'text-[#d7d2cb]/50 hover:text-[#d7d2cb]/70 hover:bg-white/5'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff7f00]"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'heatmap' && (
            <div>
              <CardHeader>
                <CardTitle className="text-3xl font-semibold text-[#d7d2cb]">
                  Activity Heatmap
                </CardTitle>
                <p className="text-[#d7d2cb]/70 mt-2">
                  {tabs.find(t => t.id === 'heatmap')?.description}
                </p>
              </CardHeader>
              <CardContent className="py-3 px-6 overflow-visible">
                <ActivityHeatmap
                  data={activityData}
                  onDayClick={onDayClick}
                />
              </CardContent>
            </div>
          )}

          {activeTab === 'trend' && (
            <div>
              <CardHeader>
                <CardTitle className="text-3xl font-semibold text-[#d7d2cb]">
                  Completion Trend
                </CardTitle>
                <p className="text-[#d7d2cb]/70 mt-2">
                  {tabs.find(t => t.id === 'trend')?.description}
                </p>
              </CardHeader>
              <CardContent>
                <TrendChart
                  data={completionTrend}
                  title=""
                  color="#22c55e"
                  timeRange="30d"
                  onTimeRangeChange={onTimeRangeChange}
                />
              </CardContent>
            </div>
          )}

          {activeTab === 'productivity' && (
            <div>
              <CardHeader>
                <CardTitle className="text-3xl font-semibold text-[#d7d2cb]">
                  Productivity Patterns
                </CardTitle>
                <p className="text-[#d7d2cb]/70 mt-2">
                  {tabs.find(t => t.id === 'productivity')?.description}
                </p>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={productivityPatterns}
                  title=""
                  colors={['#3b82f6']}
                />
              </CardContent>
            </div>
          )}

          {activeTab === 'rescheduling' && (
            <div>
              <CardHeader>
                <CardTitle className="text-3xl font-semibold text-[#d7d2cb]">
                  Rescheduling Analysis
                </CardTitle>
                <p className="text-[#d7d2cb]/70 mt-2">
                  {tabs.find(t => t.id === 'rescheduling')?.description}
                </p>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={reschedulingAnalysis}
                  title=""
                  stacked={true}
                  colors={['#22c55e', '#f59e0b']}
                />
              </CardContent>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}

