'use client'

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useTrackButtonClick } from "@/lib/analytics/button-tracking"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 micro-animate gpu-accelerated",
  {
    variants: {
      variant: {
        default: "bg-white/10 text-[#d7d2cb] hover:bg-white/20 border border-white/20 hover:border-white/30",
        primary: "bg-[#ff7f00] text-white hover:bg-[#e67300] shadow-lg shadow-[#ff7f00]/25 hover:shadow-[#ff7f00]/35",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-white/20 bg-transparent text-[#d7d2cb] hover:bg-white/10 hover:border-white/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-[#d7d2cb] hover:bg-white/10",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-lg px-3",
        lg: "h-11 rounded-lg px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Optional: Enable button click tracking */
  trackClick?: boolean
  /** Optional: Button ID for tracking (auto-generated if not provided) */
  trackId?: string
  /** Optional: Location context for tracking (e.g., 'header', 'hero', 'pricing') */
  trackLocation?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, trackClick, trackId, trackLocation, onClick, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Set up button click tracking if enabled
    const buttonText = typeof children === 'string' ? children : trackId || 'button'
    const location = trackLocation || 'unknown'
    const buttonId = trackId || `button-${buttonText.toLowerCase().replace(/\s+/g, '-')}`
    const trackClickHandler = useTrackButtonClick(
      buttonId,
      buttonText,
      location,
      { variant, size }
    )
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Track click if enabled
      if (trackClick) {
        trackClickHandler(e)
      }
      // Call original onClick handler
      onClick?.(e)
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

