'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from './Card'
import { ActivityHeatmap, ActivityHeatmapData } from './ActivityHeatmap'
import { ActivityHeatmapNavigation } from './ActivityHeatmapNavigation'
import { TrendChart, TrendChartData } from './TrendChart'
import { BarChart, BarChartData } from './BarChart'
import { cn } from '@/lib/utils'
import { 
  analyzeActivityHeatmap, 
  analyzeCompletionTrend, 
  analyzeProductivityPatterns, 
  analyzeRescheduling 
} from '@/lib/analytics-insights'

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
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  return (
    <Card className="bg-white/5 border border-white/10 mb-8">
      {/* Tabs Header */}
      <div className="border-b border-white/10">
        <div className="grid grid-cols-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap rounded-t-md',
                activeTab === tab.id
                  ? 'text-[#d7d2cb]'
                  : 'text-[#d7d2cb]/50 hover:text-[#d7d2cb]/70'
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
              <CardHeader className="flex items-start justify-between gap-4 pb-4">
                <div className="flex-1">
                  <CardTitle className="text-3xl font-semibold text-[#d7d2cb]">
                    Activity Heatmap
                  </CardTitle>
                  <p className="text-[#d7d2cb]/70 mt-2">
                    {tabs.find(t => t.id === 'heatmap')?.description}
                  </p>
                </div>
                <div className="flex-shrink-0" style={{ marginRight: 'calc((100% - 0.5rem) / 7 * 0.5)' }}>
                  <ActivityHeatmapNavigation
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    onMonthChange={setSelectedMonth}
                    onYearChange={setSelectedYear}
                  />
                </div>
              </CardHeader>
              <CardContent className="py-3 px-6 overflow-visible">
                <div>
                  <ActivityHeatmap
                    data={activityData}
                    onDayClick={onDayClick}
                    selectedMonth={selectedMonth}
                    selectedYear={selectedYear}
                    showNavigation={false}
                  />
                </div>
                <div className="mt-6 p-5 bg-white/5 border border-white/10 rounded-lg">
                  <h4 className="text-sm font-semibold text-[#d7d2cb] mb-2">Insights</h4>
                  <p className="text-sm text-[#d7d2cb]/80 leading-relaxed">
                    {analyzeActivityHeatmap(activityData)}
                  </p>
                </div>
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
              <CardContent className="px-6">
                <div>
                  <TrendChart
                    data={completionTrend}
                    title=""
                    color="#22c55e"
                    timeRange="30d"
                    onTimeRangeChange={onTimeRangeChange}
                  />
                </div>
                <div className="mt-6 p-5 bg-white/5 border border-white/10 rounded-lg">
                  <h4 className="text-sm font-semibold text-[#d7d2cb] mb-2">Insights</h4>
                  <p className="text-sm text-[#d7d2cb]/80 leading-relaxed">
                    {analyzeCompletionTrend(completionTrend)}
                  </p>
                </div>
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
              <CardContent className="px-6">
                <div>
                  <BarChart
                    data={productivityPatterns}
                    title=""
                    colors={['#3b82f6']}
                  />
                </div>
                <div className="mt-6 p-5 bg-white/5 border border-white/10 rounded-lg">
                  <h4 className="text-sm font-semibold text-[#d7d2cb] mb-2">Insights</h4>
                  <p className="text-sm text-[#d7d2cb]/80 leading-relaxed">
                    {analyzeProductivityPatterns(productivityPatterns)}
                  </p>
                </div>
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
              <CardContent className="px-6">
                <div>
                  <BarChart
                    data={reschedulingAnalysis}
                    title=""
                    stacked={true}
                    colors={['#22c55e', '#f59e0b']}
                  />
                </div>
                <div className="mt-6 p-5 bg-white/5 border border-white/10 rounded-lg">
                  <h4 className="text-sm font-semibold text-[#d7d2cb] mb-2">Insights</h4>
                  <p className="text-sm text-[#d7d2cb]/80 leading-relaxed">
                    {analyzeRescheduling(reschedulingAnalysis)}
                  </p>
                </div>
              </CardContent>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Card>
  )
}

