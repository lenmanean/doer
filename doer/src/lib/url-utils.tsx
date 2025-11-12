/**
 * Utility functions for URL detection and link conversion
 */

import React from 'react'

/**
 * Detects URLs in text using a regex pattern
 * Supports http://, https://, and www. patterns
 */
export function detectUrls(text: string): string[] {
  if (!text) return []
  
  // Pattern to match URLs (http://, https://, www.)
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  const matches = text.match(urlPattern)
  return matches || []
}

/**
 * Converts plain text with URLs into JSX with clickable links
 * Returns an array of React nodes (text and anchor elements)
 */
export function convertUrlsToLinks(text: string): React.ReactNode[] {
  if (!text) return []
  
  // Pattern to match URLs
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match
  
  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    
    // Add the URL as a clickable link
    let url = match[0]
    // Add https:// prefix if it's a www. URL
    if (url.startsWith('www.')) {
      url = `https://${url}`
    }
    
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#ff7f00] hover:text-[#ff9500] underline break-all"
      >
        {match[0]}
      </a>
    )
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  // If no URLs were found, return the original text
  if (parts.length === 0) {
    return [text]
  }
  
  return parts
}

/**
 * Checks if text contains any URLs
 */
export function hasUrls(text: string): boolean {
  if (!text) return false
  const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  return urlPattern.test(text)
}









