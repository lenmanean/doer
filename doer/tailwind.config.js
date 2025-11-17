/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // DOER.AI Core Colors
        background: '#0a0a0a',
        foreground: '#d7d2cb',
        'bg-warm': '#d7d2cb',
        charcoal: '#353839',
        
        // Semantic Colors
        muted: {
          DEFAULT: '#94a3b8',
          foreground: '#64748b',
        },
        primary: {
          DEFAULT: '#ea580c',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#353839',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        border: 'rgba(255, 255, 255, 0.1)',
        input: 'rgba(255, 255, 255, 0.05)',
        ring: '#ea580c',
      },
      
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'monospace'],
      },
      
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
      
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '16px',
        xl: '24px',
      },
      
      keyframes: {
        'animate-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'animate-in-fast': {
          '0%': {
            opacity: '0',
            transform: 'translateY(15px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'animate-in-slow': {
          '0%': {
            opacity: '0',
            transform: 'translateY(25px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        'animate-out': {
          '0%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
          '100%': {
            opacity: '0',
            transform: 'translateY(-10px)',
          },
        },
        'page-fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'panel-fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px) scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0) scale(1)',
          },
        },
        'stagger-fade-in': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'slide-in-from-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-from-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'slide-in-from-top': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      
      animation: {
        'in': 'animate-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'in-fast': 'animate-in-fast 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'in-slow': 'animate-in-slow 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'out': 'animate-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'page-fade': 'page-fade-in 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'panel-fade': 'panel-fade-in 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'stagger-fade': 'stagger-fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'shimmer': 'shimmer 1.5s infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-right': 'slide-in-from-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-left': 'slide-in-from-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-top': 'slide-in-from-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-bottom': 'slide-in-from-bottom 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'smooth-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'smooth-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glow': '0 0 20px rgba(255, 127, 0, 0.3)',
        'glow-lg': '0 0 40px rgba(255, 127, 0, 0.4)',
        'orange': '0 4px 14px 0 rgba(255, 127, 0, 0.25)',
        'orange-lg': '0 6px 20px 0 rgba(255, 127, 0, 0.35)',
      },
      
      backgroundImage: {
        'gradient-orange': 'linear-gradient(135deg, #ff7f00 0%, #ea580c 100%)',
        'gradient-orange-hover': 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
        'gradient-text': 'linear-gradient(135deg, #ff7f00 0%, #ea580c 50%, #dc2626 100%)',
      },
    },
  },
  plugins: [
    // Custom utilities plugin
    function({ addUtilities }) {
      const newUtilities = {
        '.focus-ring': {
          '@apply focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-transparent': {},
        },
        '.glass-panel': {
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '0.75rem',
        },
        '.gradient-text': {
          background: 'linear-gradient(135deg, #ff7f00 0%, #ea580c 50%, #dc2626 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        },
        '.doer-hover': {
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          },
        },
        '.micro-animate': {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        '.gpu-accelerated': {
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          perspective: '1000px',
        },
        '.scrollbar-hide': {
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
      }
      addUtilities(newUtilities)
    },
  ],
};
  