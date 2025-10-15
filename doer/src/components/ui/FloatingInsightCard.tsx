'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function FloatingInsightCard({
  progress,
  consistency,
  efficiency,
}: {
  progress: number
  consistency: number
  efficiency: number
}) {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  
  const insights = [
    { key: 'progress', text: `Progress ${progress >= 0 ? 'up' : 'down'} ${Math.abs(progress).toFixed(0)}%` },
    { key: 'consistency', text: `Consistency ${consistency >= 0 ? 'up' : 'down'} ${Math.abs(consistency).toFixed(0)}%` },
    { key: 'efficiency', text: `Efficiency ${efficiency >= 0 ? 'up' : 'down'} ${Math.abs(efficiency).toFixed(0)}%` },
  ]

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(() => setIndex((i) => (i + 1) % insights.length), 6000)
    return () => clearInterval(interval)
  }, [isPaused, insights.length])

  const active = insights[index]

  return (
    <motion.div
      className="relative text-center cursor-default"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={active.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-[#d7d2cb]/70 text-xl font-medium"
        >
          {active.text}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

