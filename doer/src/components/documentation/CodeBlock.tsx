'use client'

import { useState, useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  language: string
  filename?: string
  className?: string
}

export function CodeBlock({ code, language, filename, className }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [isDark, setIsDark] = useState(true)

  // Detect theme from document
  useEffect(() => {
    const checkTheme = () => {
      if (typeof window !== 'undefined') {
        const htmlElement = document.documentElement
        setIsDark(htmlElement.classList.contains('dark'))
      }
    }
    
    checkTheme()
    
    // Watch for theme changes
    const observer = new MutationObserver(checkTheme)
    if (typeof window !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      })
    }
    
    return () => observer.disconnect()
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  const style = isDark ? oneDark : oneLight

  return (
    <div className={cn('relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700', className)}>
      {filename && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 font-mono">
          {filename}
        </div>
      )}
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-gray-800/80 dark:bg-gray-900/80 hover:bg-gray-700/80 dark:hover:bg-gray-800/80 text-gray-200 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
        <SyntaxHighlighter
          language={language}
          style={style}
          customStyle={{
            margin: 0,
            padding: '1rem',
            backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          showLineNumbers={code.split('\n').length > 5}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

