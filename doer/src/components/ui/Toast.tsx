'use client'

import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

function toastReducer(state: Toast[], action: { type: string; payload: any }) {
  switch (action.type) {
    case 'ADD_TOAST':
      return [...state, action.payload]
    case 'REMOVE_TOAST':
      return state.filter(toast => toast.id !== action.payload)
    case 'CLEAR_ALL':
      return []
    default:
      return state
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, [])

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast = { ...toast, id }
    dispatch({ type: 'ADD_TOAST', payload: newToast })

    // Auto remove toast after duration
    const duration = toast.duration || 5000
    setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', payload: id })
    }, duration)
  }

  const removeToast = (id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id })
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />
      default:
        return <Info className="w-5 h-5 text-blue-400" />
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500/30'
      case 'error':
        return 'border-red-500/30'
      case 'warning':
        return 'border-yellow-500/30'
      case 'info':
        return 'border-blue-500/30'
      default:
        return 'border-blue-500/30'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300, scale: 0.3 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
      className={`glass-panel border ${getBorderColor()} max-w-sm w-full`}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#d7d2cb]">
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 text-sm text-[#d7d2cb]/70">
              {toast.description}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <button
            onClick={() => onRemove(toast.id)}
            className="inline-flex text-[#d7d2cb]/50 hover:text-[#d7d2cb] focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:ring-offset-2 focus:ring-offset-transparent rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

