'use client'

import { useMemo } from 'react'
import Link from 'next/link'

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const renderContent = useMemo(() => {
    const lines = content.split('\n')
    const elements: JSX.Element[] = []
    let currentParagraph: string[] = []
    let inList = false
    let listItems: string[] = []
    let listType: 'ul' | 'ol' = 'ul'
    let keyCounter = 0

    const getKey = () => `md-${keyCounter++}`

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(' ').trim()
        if (text) {
          elements.push(
            <p key={getKey()} className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">
              {parseInlineMarkdown(text)}
            </p>
          )
        }
        currentParagraph = []
      }
    }

    const flushList = () => {
      if (listItems.length > 0) {
        const ListTag = listType === 'ul' ? 'ul' : 'ol'
        elements.push(
          <ListTag key={getKey()} className={`${listType === 'ul' ? 'list-disc' : 'list-decimal'} space-y-2 my-4 ml-6`}>
            {listItems.map((item, idx) => (
              <li key={idx} className="text-gray-700 dark:text-gray-300">
                {parseInlineMarkdown(item)}
              </li>
            ))}
          </ListTag>
        )
        listItems = []
        inList = false
      }
    }

    const parseInlineMarkdown = (text: string): (string | JSX.Element)[] => {
      const parts: (string | JSX.Element)[] = []
      const tokens: Array<{ type: 'text' | 'link' | 'bold' | 'italic' | 'code'; content: string; url?: string }> = []
      
      // Extract links first
      let remaining = text
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
      let lastIndex = 0
      let match

      while ((match = linkRegex.exec(remaining)) !== null) {
        if (match.index > lastIndex) {
          tokens.push({ type: 'text', content: remaining.slice(lastIndex, match.index) })
        }
        tokens.push({ type: 'link', content: match[1], url: match[2] })
        lastIndex = linkRegex.lastIndex
      }

      if (lastIndex < remaining.length) {
        tokens.push({ type: 'text', content: remaining.slice(lastIndex) })
      }

      // Process each token
      tokens.forEach((token) => {
        if (token.type === 'link') {
          const isExternal = token.url?.startsWith('http')
          const linkClass = 'text-orange-500 dark:text-orange-400 hover:underline'
          if (isExternal) {
            parts.push(
              <a
                key={getKey()}
                href={token.url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                {token.content}
              </a>
            )
          } else {
            parts.push(
              <Link key={getKey()} href={token.url || '#'} className={linkClass}>
                {token.content}
              </Link>
            )
          }
        } else {
          // Process formatting in text
          let text = token.content
          const formatted: Array<{ type: 'text' | 'bold' | 'italic' | 'code'; content: string }> = []

          // Extract bold
          const boldRegex = /\*\*(.*?)\*\*/g
          let boldMatch
          let lastBoldIndex = 0
          const boldPositions: Array<{ start: number; end: number; content: string }> = []

          while ((boldMatch = boldRegex.exec(text)) !== null) {
            boldPositions.push({
              start: boldMatch.index,
              end: boldRegex.lastIndex,
              content: boldMatch[1],
            })
          }

          // Extract italic (not inside bold)
          const italicRegex = /\*(.*?)\*/g
          let italicMatch
          const italicPositions: Array<{ start: number; end: number; content: string }> = []

          while ((italicMatch = italicRegex.exec(text)) !== null) {
            // Check if not inside a bold match
            const isInsideBold = boldPositions.some(
              (bp) => italicMatch!.index >= bp.start && italicMatch!.index < bp.end
            )
            if (!isInsideBold) {
              italicPositions.push({
                start: italicMatch.index,
                end: italicRegex.lastIndex,
                content: italicMatch[1],
              })
            }
          }

          // Extract code
          const codeRegex = /`([^`]+)`/g
          let codeMatch
          const codePositions: Array<{ start: number; end: number; content: string }> = []

          while ((codeMatch = codeRegex.exec(text)) !== null) {
            codePositions.push({
              start: codeMatch.index,
              end: codeRegex.lastIndex,
              content: codeMatch[1],
            })
          }

          // Combine and sort all positions
          const allPositions = [
            ...boldPositions.map((p) => ({ ...p, type: 'bold' as const })),
            ...italicPositions.map((p) => ({ ...p, type: 'italic' as const })),
            ...codePositions.map((p) => ({ ...p, type: 'code' as const })),
          ].sort((a, b) => a.start - b.start)

          // Build formatted array
          let currentIndex = 0
          allPositions.forEach((pos) => {
            if (pos.start > currentIndex) {
              formatted.push({ type: 'text', content: text.slice(currentIndex, pos.start) })
            }
            formatted.push({ type: pos.type, content: pos.content })
            currentIndex = pos.end
          })

          if (currentIndex < text.length) {
            formatted.push({ type: 'text', content: text.slice(currentIndex) })
          }

          if (formatted.length === 0) {
            formatted.push({ type: 'text', content: text })
          }

          // Render formatted parts
          formatted.forEach((item) => {
            if (item.type === 'text') {
              parts.push(item.content)
            } else if (item.type === 'bold') {
              parts.push(
                <strong key={getKey()} className="font-bold text-gray-900 dark:text-white">
                  {item.content}
                </strong>
              )
            } else if (item.type === 'italic') {
              parts.push(
                <em key={getKey()} className="italic">
                  {item.content}
                </em>
              )
            } else if (item.type === 'code') {
              parts.push(
                <code key={getKey()} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">
                  {item.content}
                </code>
              )
            }
          })
        }
      })

      return parts.length > 0 ? parts : [text]
    }

    lines.forEach((line) => {
      const trimmed = line.trim()

      // Headers
      if (trimmed.startsWith('### ')) {
        flushParagraph()
        flushList()
        const text = trimmed.slice(4)
        elements.push(
          <h3 key={getKey()} className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4">
            {parseInlineMarkdown(text)}
          </h3>
        )
        return
      }

      if (trimmed.startsWith('## ')) {
        flushParagraph()
        flushList()
        const text = trimmed.slice(3)
        elements.push(
          <h2 key={getKey()} className="text-3xl font-bold text-gray-900 dark:text-white mt-10 mb-6">
            {parseInlineMarkdown(text)}
          </h2>
        )
        return
      }

      if (trimmed.startsWith('# ')) {
        flushParagraph()
        flushList()
        const text = trimmed.slice(2)
        elements.push(
          <h1 key={getKey()} className="text-4xl font-bold text-gray-900 dark:text-white mt-12 mb-8">
            {parseInlineMarkdown(text)}
          </h1>
        )
        return
      }

      // Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        flushParagraph()
        if (!inList) {
          inList = true
          listType = 'ul'
        }
        listItems.push(trimmed.slice(2))
        return
      }

      if (/^\d+\. /.test(trimmed)) {
        flushParagraph()
        if (!inList) {
          inList = true
          listType = 'ol'
        }
        listItems.push(trimmed.replace(/^\d+\. /, ''))
        return
      }

      // Empty line
      if (!trimmed) {
        flushParagraph()
        flushList()
        return
      }

      // Regular paragraph
      if (inList) {
        flushList()
      }
      currentParagraph.push(trimmed)
    })

    flushParagraph()
    flushList()

    return elements
  }, [content])

  return (
    <div className="prose prose-lg dark:prose-invert max-w-none">
      {renderContent}
    </div>
  )
}
