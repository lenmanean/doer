'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, CreditCard, XCircle, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { useToast } from './Toast'

interface PlanManagementDropdownProps {
  onUpgrade: () => void
  onCancel: () => void
  onManagePayment: () => void
  isCanceling?: boolean
  isOpeningPortal?: boolean
  showCancel?: boolean
  showManagePayment?: boolean
}

export function PlanManagementDropdown({
  onUpgrade,
  onCancel,
  onManagePayment,
  isCanceling = false,
  isOpeningPortal = false,
  showCancel = true,
  showManagePayment = true,
}: PlanManagementDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="default"
        className="flex items-center gap-2"
      >
        Manage
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-lg z-20">
            <div className="py-1">
              <button
                onClick={() => {
                  onUpgrade()
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#d7d2cb] hover:bg-white/10 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Upgrade Plan
              </button>
              {showCancel && (
                <button
                  onClick={() => {
                    onCancel()
                    setIsOpen(false)
                  }}
                  disabled={isCanceling}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#d7d2cb] hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  {isCanceling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancel Subscription
                </button>
              )}
              {showManagePayment && (
                <button
                  onClick={() => {
                    onManagePayment()
                    setIsOpen(false)
                  }}
                  disabled={isOpeningPortal}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[#d7d2cb] hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  {isOpeningPortal ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage Payment
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}





