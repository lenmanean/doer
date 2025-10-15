'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  LayoutDashboard, 
  Map, 
  Upload, 
  Zap, 
  User, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  HelpCircle,
  Heart,
  Users
} from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  user?: {
    name?: string
    email?: string
    avatar_url?: string
    display_name?: string
  }
  onSignOut: () => void
  currentPath?: string
}

const Sidebar = ({ user, onSignOut, currentPath = '/dashboard' }: SidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

  const navigationItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Roadmap', href: '/roadmap', icon: Map },
    { name: 'Health', href: '/health', icon: Heart },
    { name: 'Community', href: '/community', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Help', href: '/help', icon: HelpCircle },
  ]

  const isActive = (href: string) => currentPath === href

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen)
  }

  const handleSignOut = () => {
    setShowSignOutConfirm(true)
  }

  const confirmSignOut = () => {
    setShowSignOutConfirm(false)
    onSignOut()
  }

  const cancelSignOut = () => {
    setShowSignOutConfirm(false)
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden glass-panel border border-white/20 text-[#d7d2cb] hover:text-[#ff7f00] hover:bg-white/10"
        onClick={toggleMobileSidebar}
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* Desktop Overlay - Click outside to close */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 hidden md:block"
            onClick={toggleSidebar}
          />
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
            onClick={toggleMobileSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 280,
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          'fixed left-0 top-0 h-full z-50 border-r border-white/20',
          'md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          isCollapsed 
            ? 'glass-panel' 
            : 'glass-panel shadow-2xl shadow-black/20'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-center p-3 border-b border-white/10">
            {/* Hamburger Menu - Only show when collapsed */}
            {isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex text-[#d7d2cb]/70 hover:text-[#ff7f00] hover:bg-white/10 w-10 h-10 p-2"
                onClick={toggleSidebar}
              >
                <Menu className="w-5 h-5" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col justify-evenly px-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <motion.a
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7f00] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent micro-animate gpu-accelerated group',
                    isCollapsed 
                      ? 'justify-center p-4 -ml-1' 
                      : 'space-x-3 px-4 py-3',
                    isActive(item.href)
                      ? 'bg-[#ff7f00]/20 text-[#ff7f00] border border-[#ff7f00]/30'
                      : 'text-[#d7d2cb]/70 hover:text-[#d7d2cb] hover:bg-white/10'
                  )}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  onClick={() => {
                    setIsMobileOpen(false)
                    setIsCollapsed(true)
                  }}
                >
                  <Icon className={cn(
                    'flex-shrink-0',
                    isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
                  )} />
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="truncate"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </motion.a>
              )
            })}
          </nav>

          {/* User Section */}
          <div className="py-3 px-1 border-t border-white/10">
            {!isCollapsed && user && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-3"
              >
                <div className="flex items-center space-x-3 px-3 py-2">
                  <div className="w-7 h-7 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center overflow-hidden">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold text-xs">
                        {(user.display_name || user.name || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#d7d2cb] truncate">
                      {user.display_name || user.name || 'User'}
                    </p>
                    <p className="text-xs text-[#d7d2cb]/60 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Sign Out Button */}
            <Button
              variant="ghost"
              className={cn(
                'w-full text-[#d7d2cb]/70 hover:text-red-400 hover:bg-red-500/20 transition-all duration-300 micro-animate',
                isCollapsed 
                  ? 'justify-center p-4 -ml-1' 
                  : 'justify-start space-x-3 px-4 py-3 -ml-1'
              )}
              onClick={handleSignOut}
            >
              <LogOut className={cn(
                'flex-shrink-0',
                isCollapsed ? 'w-5 h-5' : 'w-4 h-4'
              )} />
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="truncate"
                >
                  Sign Out
                </motion.span>
              )}
            </Button>
          </div>
        </div>
      </motion.aside>

      {/* Main Content Spacer */}
      <div
        className={cn(
          'transition-all duration-300 ease-out',
          isCollapsed ? 'md:ml-20' : 'md:ml-72'
        )}
      />

      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-[60] flex items-center justify-center p-4"
            onClick={cancelSignOut}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="glass-panel p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-[#d7d2cb] mb-2">
                  Sign Out
                </h3>
                <p className="text-[#d7d2cb]/70 mb-6">
                  Are you sure you want to sign out? You'll need to log in again to access your account.
                </p>
                <div className="flex space-x-3">
                  <motion.button
                    className="flex-1 h-10 px-4 py-2 text-[#d7d2cb] bg-transparent border border-white/20 rounded-lg hover:bg-white/10 hover:border-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:ring-offset-2 focus:ring-offset-transparent flex items-center justify-center"
                    onClick={cancelSignOut}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    className="flex-1 h-10 px-4 py-2 text-white bg-red-500 border border-red-500 rounded-lg hover:bg-red-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-transparent flex items-center justify-center"
                    onClick={confirmSignOut}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  >
                    Sign Out
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export { Sidebar }

