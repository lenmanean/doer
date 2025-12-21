'use client'

import { useState } from 'react'

interface EmailReviewClientProps {
  secretKey: string
}

/**
 * Client component for interactive email review buttons
 */
export function EmailReviewClient({ secretKey }: EmailReviewClientProps) {
  const [status, setStatus] = useState<{ type?: string; success?: boolean; error?: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSendEmail = async (type: 'welcome' | 'week_out' | 'launch') => {
    setLoading(true)
    setStatus(null)

    try {
      const response = await fetch('/api/internal/email-force-send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-preview-secret': secretKey,
        },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) {
        throw new Error('Failed to send email')
      }

      const data = await response.json()
      setStatus({ type, success: true })
    } catch (error) {
      setStatus({ 
        type, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Internal Email Review</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Force-send production emails to internal address for content verification
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button
          onClick={() => handleSendEmail('welcome')}
          disabled={loading}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading && status?.type === 'welcome' ? 'Sending...' : 'Send Welcome Email'}
        </button>

        <button
          onClick={() => handleSendEmail('week_out')}
          disabled={loading}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading && status?.type === 'week_out' ? 'Sending...' : 'Send Week-Out Email'}
        </button>

        <button
          onClick={() => handleSendEmail('launch')}
          disabled={loading}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            backgroundColor: loading ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading && status?.type === 'launch' ? 'Sending...' : 'Send Launch Email'}
        </button>
      </div>

      {status && (
        <div
          style={{
            marginTop: '2rem',
            padding: '1rem',
            backgroundColor: status.success ? '#d4edda' : '#f8d7da',
            color: status.success ? '#155724' : '#721c24',
            borderRadius: '4px',
          }}
        >
          {status.success ? (
            <p>✓ {status.type} email sent successfully</p>
          ) : (
            <p>✗ Failed to send {status.type} email: {status.error}</p>
          )}
        </div>
      )}
    </div>
  )
}

