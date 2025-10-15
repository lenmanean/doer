'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'

interface FadeInWrapperProps {
  children: ReactNode
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
  once?: boolean
}

const directionVariants = {
  up: { y: 20 },
  down: { y: -20 },
  left: { x: 20 },
  right: { x: -20 },
  none: { x: 0, y: 0 }
}

export function FadeInWrapper({
  children,
  delay = 0,
  duration = 0.6,
  direction = 'up',
  className = '',
  once = true
}: FadeInWrapperProps) {
  return (
    <motion.div
      className={className}
      initial={{ 
        opacity: 0, 
        ...directionVariants[direction]
      }}
      animate={{ 
        opacity: 1, 
        x: 0, 
        y: 0 
      }}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1], // Custom easing for smooth animation
        type: 'tween'
      }}
      viewport={{ once }}
    >
      {children}
    </motion.div>
  )
}

// Staggered animation for multiple children
interface StaggeredFadeInProps {
  children: ReactNode[]
  delay?: number
  staggerDelay?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  className?: string
}

export function StaggeredFadeIn({
  children,
  delay = 0,
  staggerDelay = 0.1,
  direction = 'up',
  className = ''
}: StaggeredFadeInProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            delayChildren: delay,
            staggerChildren: staggerDelay
          }
        }
      }}
    >
      {children.map((child, index) => (
        <motion.div
          key={index}
          variants={{
            hidden: { 
              opacity: 0, 
              ...directionVariants[direction]
            },
            visible: { 
              opacity: 1, 
              x: 0, 
              y: 0,
              transition: {
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1]
              }
            }
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}

// Page-level fade in with different sections
interface PageFadeInProps {
  children: ReactNode
  className?: string
}

export function PageFadeIn({ children, className = '' }: PageFadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      {children}
    </motion.div>
  )
}

// Panel fade in with slide effect
interface PanelFadeInProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function PanelFadeIn({ children, delay = 0, className = '' }: PanelFadeInProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      {children}
    </motion.div>
  )
}
