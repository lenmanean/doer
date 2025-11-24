'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

interface NavItem {
  id: string
  title: string
  children?: NavItem[]
}

interface DocumentationSidebarProps {
  items: NavItem[]
  currentSection?: string
}

export function DocumentationSidebar({ items, currentSection }: DocumentationSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeSection, setActiveSection] = useState(currentSection || '')

  useEffect(() => {
    const handleScroll = () => {
      const sections = items.flatMap(item => [
        item.id,
        ...(item.children?.map(child => child.id) || [])
      ])

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = document.getElementById(sections[i])
        if (section) {
          const rect = section.getBoundingClientRect()
          if (rect.top <= 100) {
            setActiveSection(sections[i])
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Check on mount

    return () => window.removeEventListener('scroll', handleScroll)
  }, [items])

  const handleNavClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
      setIsOpen(false)
    }
  }

  const renderNavItem = (item: NavItem, level: number = 0) => {
    const isActive = activeSection === item.id
    const hasChildren = item.children && item.children.length > 0

    return (
      <li key={item.id} className={cn(level > 0 && 'ml-4')}>
        <button
          onClick={() => handleNavClick(item.id)}
          className={cn(
            'w-full text-left px-3 py-2 rounded-lg transition-colors text-sm',
            isActive
              ? 'bg-orange-500/20 text-orange-500 dark:text-orange-400 font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
            level === 0 && 'font-medium'
          )}
        >
          {item.title}
        </button>
        {hasChildren && (
          <ul className="mt-1 space-y-1">
            {item.children!.map(child => renderNavItem(child, level + 1))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-20 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
        aria-label="Toggle navigation"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setIsOpen(false)}
            />
            {/* Sidebar Panel - Mobile */}
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                'md:hidden fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 overflow-y-auto p-4'
              )}
            >
              <nav>
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 px-3">
                  Contents
                </h2>
                <ul className="space-y-1">
                  {items.map(item => renderNavItem(item))}
                </ul>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar - Always Visible */}
      <aside className="hidden md:block sticky top-20 h-[calc(100vh-5rem)] w-64 overflow-y-auto p-4 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        <nav>
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 px-3">
            Contents
          </h2>
          <ul className="space-y-1">
            {items.map(item => renderNavItem(item))}
          </ul>
        </nav>
      </aside>
    </>
  )
}

