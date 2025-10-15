'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './Button'
import { Save, X, AlertTriangle } from 'lucide-react'

export function FloatingSavePanel({
  visible,
  onSave,
  onDiscard,
  warnings,
  isSaving
}: {
  visible: boolean,
  onSave: () => void,
  onDiscard: () => void,
  warnings: string[],
  isSaving: boolean
}) {
  const [scrollY, setScrollY] = useState(0)
  
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])
  
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-8 right-8 z-50"
        >
          <div className="bg-[#0a0a0a]/95 backdrop-blur-md border border-white/20 rounded-xl shadow-2xl p-4 min-w-[320px]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-[#d7d2cb]">Unsaved Changes</h4>
              {warnings.length > 0 && (
                <div className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-xs">{warnings.length}</span>
                </div>
              )}
            </div>
            
            {warnings.length > 0 && (
              <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-h-24 overflow-y-auto">
                {warnings.map((warning, i) => (
                  <p key={i} className="text-xs text-yellow-500 mb-1 last:mb-0">{warning}</p>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button
                onClick={onDiscard}
                variant="outline"
                className="flex-1"
                disabled={isSaving}
              >
                <X className="w-4 h-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={onSave}
                className="flex-1 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}






