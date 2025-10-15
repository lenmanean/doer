# Health Analytics UI Integration Guide

How to integrate the new health snapshot analytics into your health page.

---

## 🎯 Available Analytics Functions

You now have these functions ready to use in `doer/src/lib/analytics.ts`:

```typescript
import { 
  fetchHealthHistory,        // Get past N days of snapshots
  fetchWeeklyHealthAnalytics, // Get weekly aggregates
  fetchHealthInsights         // Get trend analysis
} from '@/lib/analytics'
```

---

## 📊 Integration Options

### Option 1: Add Insights Banner (Easiest)

Add a trend insight banner above or below the orb visualization.

**Add to your health page state:**

```typescript
// Add to existing state (around line 40)
const [healthInsight, setHealthInsight] = useState<{
  trend: 'improving' | 'declining' | 'neutral'
  message: string
  change: number
} | null>(null)
```

**Fetch insights in useEffect:**

```typescript
// Add to your existing health metrics loading (around line 58)
const metrics = await fetchHealthMetrics(user.id, planId)
const insights = await fetchHealthInsights(user.id, planId)

setHealthScore(metrics.healthScore)
// ... existing state updates ...
setHealthInsight(insights)
```

**Add UI component:**

```tsx
{/* Add this right after the Sidebar, before <main> */}
{healthInsight && healthInsight.trend !== 'neutral' && (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
  >
    <div className={`px-6 py-3 rounded-full border backdrop-blur-sm ${
      healthInsight.trend === 'improving' 
        ? 'bg-green-500/10 border-green-500/30 text-green-300' 
        : 'bg-red-500/10 border-red-500/30 text-red-300'
    }`}>
      <div className="flex items-center gap-2">
        {healthInsight.trend === 'improving' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        )}
        <span className="font-medium">{healthInsight.message}</span>
      </div>
    </div>
  </motion.div>
)}
```

---

### Option 2: Add History Chart Modal

Add a detailed history view when clicking on an orb.

**Create a new component: `doer/src/components/ui/HealthHistoryModal.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchHealthHistory } from '@/lib/analytics'
import { X } from 'lucide-react'

interface HealthSnapshot {
  snapshot_date: string
  health_score: number
  progress: number
  consistency: number
  efficiency: number | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  userId: string
  planId: string
  metricName: 'progress' | 'consistency' | 'efficiency'
}

export function HealthHistoryModal({ isOpen, onClose, userId, planId, metricName }: Props) {
  const [history, setHistory] = useState<HealthSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  useEffect(() => {
    if (!isOpen) return
    
    const load = async () => {
      setLoading(true)
      try {
        const data = await fetchHealthHistory(userId, planId, days)
        setHistory(data)
      } catch (e) {
        console.error('Failed to load health history', e)
      } finally {
        setLoading(false)
      }
    }
    
    load()
  }, [isOpen, userId, planId, days])

  const getMetricValue = (snapshot: HealthSnapshot) => {
    return metricName === 'efficiency' 
      ? (snapshot.efficiency ?? 0)
      : snapshot[metricName]
  }

  const maxValue = Math.max(...history.map(getMetricValue), 100)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-[#1a1a1a] border border-[#d7d2cb]/10 rounded-2xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-[#d7d2cb] capitalize">
                  {metricName} History
                </h2>
                <p className="text-[#d7d2cb]/60 text-sm mt-1">
                  Last {days} days
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-[#d7d2cb]/60" />
              </button>
            </div>

            {/* Time range selector */}
            <div className="flex gap-2 mb-6">
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-4 py-2 rounded-lg text-sm transition-all ${
                    days === d
                      ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                      : 'bg-white/5 text-[#d7d2cb]/60 hover:bg-white/10'
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>

            {/* Chart */}
            {loading ? (
              <div className="h-64 flex items-center justify-center text-[#d7d2cb]/60">
                Loading...
              </div>
            ) : history.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-[#d7d2cb]/60">
                No data available yet. Snapshots are captured daily.
              </div>
            ) : (
              <div className="h-64 relative">
                {/* Simple bar chart */}
                <div className="flex items-end justify-between h-full gap-1">
                  {history.map((snapshot, idx) => {
                    const value = getMetricValue(snapshot)
                    const height = (value / maxValue) * 100
                    const date = new Date(snapshot.snapshot_date)
                    const label = `${date.getMonth() + 1}/${date.getDate()}`
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: idx * 0.05, duration: 0.3 }}
                          className="w-full bg-gradient-to-t from-green-500/40 to-green-400/60 rounded-t relative group"
                          style={{ minHeight: '4px' }}
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                              {Math.round(value)}%
                            </div>
                          </div>
                        </motion.div>
                        <span className="text-[10px] text-[#d7d2cb]/40">
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-[#d7d2cb]/40 -ml-8">
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
              </div>
            )}

            {/* Stats summary */}
            <div className="mt-6 pt-6 border-t border-[#d7d2cb]/10 grid grid-cols-3 gap-4">
              <div>
                <div className="text-[#d7d2cb]/60 text-xs mb-1">Average</div>
                <div className="text-2xl font-bold text-green-300">
                  {history.length > 0
                    ? Math.round(
                        history.reduce((sum, s) => sum + getMetricValue(s), 0) / history.length
                      )
                    : 0}%
                </div>
              </div>
              <div>
                <div className="text-[#d7d2cb]/60 text-xs mb-1">Highest</div>
                <div className="text-2xl font-bold text-[#d7d2cb]">
                  {history.length > 0 ? Math.round(Math.max(...history.map(getMetricValue))) : 0}%
                </div>
              </div>
              <div>
                <div className="text-[#d7d2cb]/60 text-xs mb-1">Lowest</div>
                <div className="text-2xl font-bold text-[#d7d2cb]">
                  {history.length > 0 ? Math.round(Math.min(...history.map(getMetricValue))) : 0}%
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**Update health page to use the modal:**

```typescript
// Add state (around line 40)
const [historyModal, setHistoryModal] = useState<{
  isOpen: boolean
  metric: 'progress' | 'consistency' | 'efficiency'
}>({ isOpen: false, metric: 'progress' })

// Add modal component at the end of your return statement (before closing </div>)
{user?.id && roadmapData?.plan?.id && (
  <HealthHistoryModal
    isOpen={historyModal.isOpen}
    onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
    userId={user.id}
    planId={roadmapData.plan.id}
    metricName={historyModal.metric}
  />
)}

// Add onClick to each orb (e.g., Progress orb around line 148)
<div 
  className="relative group cursor-pointer"
  onClick={() => setHistoryModal({ isOpen: true, metric: 'progress' })}
>
```

---

### Option 3: Add Detailed Stats Panel

Add a side panel showing detailed breakdown when expanded.

**Add this inside the expanded view (around line 353, before the close button):**

```tsx
{/* Stats Panel - Right Side */}
<motion.div
  className="absolute right-8 top-1/2 -translate-y-1/2 w-80 space-y-4"
  initial={{ opacity: 0, x: 50 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ delay: 0.6 }}
>
  {/* Current Health Score */}
  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
    <div className="text-[#d7d2cb]/60 text-xs mb-2">Overall Health</div>
    <div className="text-4xl font-bold text-green-300">{healthScore}%</div>
    {healthInsight && (
      <div className={`text-xs mt-2 ${
        healthInsight.trend === 'improving' ? 'text-green-400' : 
        healthInsight.trend === 'declining' ? 'text-red-400' : 
        'text-[#d7d2cb]/60'
      }`}>
        {healthInsight.trend === 'improving' ? '↗' : 
         healthInsight.trend === 'declining' ? '↘' : '→'} {healthInsight.message}
      </div>
    )}
  </div>

  {/* Penalties */}
  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
    <div className="text-[#d7d2cb]/60 text-xs mb-3">Penalties</div>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">Late Completions</span>
        <span className="text-red-400">{penalties.lateCompletions}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">Overdue Tasks</span>
        <span className="text-red-400">{penalties.overdueTasks}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">Consistency Gaps</span>
        <span className="text-red-400">{penalties.consistencyGaps}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">Progress Lag</span>
        <span className="text-red-400">{penalties.progressLag}</span>
      </div>
    </div>
  </div>

  {/* Bonuses */}
  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
    <div className="text-[#d7d2cb]/60 text-xs mb-3">Bonuses</div>
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">On-time</span>
        <span className="text-green-400">+{bonuses.ontimeCompletions}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">Early</span>
        <span className="text-green-400">+{bonuses.earlyCompletions}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#d7d2cb]/60">Streak</span>
        <span className="text-green-400">+{bonuses.streakBonus}</span>
      </div>
    </div>
  </div>

  {/* Current Streak */}
  <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
    <div className="text-[#d7d2cb]/60 text-xs mb-2">Current Streak</div>
    <div className="flex items-baseline gap-2">
      <div className="text-3xl font-bold text-[#d7d2cb]">{currentStreak}</div>
      <div className="text-[#d7d2cb]/60 text-sm">days</div>
    </div>
  </div>
</motion.div>
```

---

## 🎨 Recommended Approach

**Start with Option 1 + Option 3** for immediate value:
1. ✅ Add the insights banner (shows trend at a glance)
2. ✅ Add the detailed stats panel (shows breakdown when expanded)
3. ✅ Later add Option 2 (modal with history charts) for deep-dive analysis

---

## 📝 Complete Implementation Steps

### Step 1: Import new functions

```typescript
// Add to imports (around line 11)
import { fetchHealthMetrics, fetchHealthInsights } from '@/lib/analytics'
```

### Step 2: Add state

```typescript
// Add around line 40
const [healthInsight, setHealthInsight] = useState<any>(null)
```

### Step 3: Fetch insights

```typescript
// Update your health loading function (around line 58)
const insights = await fetchHealthInsights(user.id, planId)
setHealthInsight(insights)
```

### Step 4: Add UI components

Use the components from Options 1 and 3 above.

---

## 🚀 What You Get

- ✅ **Real-time metrics** from `fetchHealthMetrics()` (already working)
- ✅ **Trend insights** from `fetchHealthInsights()` (improving/declining)
- ✅ **Historical charts** from `fetchHealthHistory()` (optional modal)
- ✅ **Weekly analytics** from `fetchWeeklyHealthAnalytics()` (for future dashboard)

Your health snapshots are being captured daily, and the analytics functions will automatically have more data to work with over time! 📈


