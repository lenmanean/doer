'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void
  onError?: (error: string) => void
  continuous?: boolean
  interimResults?: boolean
  lang?: string
}

interface SpeechRecognitionState {
  isListening: boolean
  transcript: string
  error: string | null
  isSupported: boolean
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    onResult,
    onError,
    continuous = false,
    interimResults = true,
    lang = 'en-US',
  } = options

  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    error: null,
    isSupported: false,
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const callbacksRef = useRef({ onResult, onError })
  const isListeningRef = useRef(false)
  
  // Keep callbacks ref updated without causing re-initialization
  useEffect(() => {
    callbacksRef.current = { onResult, onError }
  }, [onResult, onError])

  // Check browser support and initialize
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setState((prev) => ({ ...prev, isSupported: false }))
      return
    }

    setState((prev) => ({ ...prev, isSupported: true }))

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = interimResults
    recognition.lang = lang

    recognition.onstart = () => {
      isListeningRef.current = true
      setState((prev) => ({
        ...prev,
        isListening: true,
        error: null,
        transcript: '',
      }))
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      const fullTranscript = finalTranscript || interimTranscript
      setState((prev) => ({
        ...prev,
        transcript: fullTranscript.trim(),
      }))

      if (finalTranscript && callbacksRef.current.onResult) {
        callbacksRef.current.onResult(finalTranscript.trim())
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'Speech recognition error occurred'
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.'
          break
        case 'audio-capture':
          errorMessage = 'Microphone not found or access denied.'
          break
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please enable it in your browser settings.'
          break
        case 'network':
          errorMessage = 'Network error. Please check your connection.'
          break
        case 'aborted':
          // User stopped manually, not an error
          isListeningRef.current = false
          setState((prev) => ({
            ...prev,
            isListening: false,
          }))
          return
        default:
          errorMessage = `Speech recognition error: ${event.error}`
      }

      isListeningRef.current = false
      setState((prev) => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }))

      if (callbacksRef.current.onError) {
        callbacksRef.current.onError(errorMessage)
      }
    }

    recognition.onend = () => {
      isListeningRef.current = false
      setState((prev) => {
        // Only update if we were actually listening
        // This prevents overriding manual stops
        if (prev.isListening) {
          return {
            ...prev,
            isListening: false,
          }
        }
        return prev
      })
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors when stopping
        }
        recognitionRef.current = null
      }
    }
  }, [continuous, interimResults, lang])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    
    // Don't start if already listening (use ref for accurate state)
    if (isListeningRef.current) return

    try {
      recognitionRef.current.start()
    } catch (error: any) {
      // Handle case where recognition is already started or in invalid state
      if (error?.name === 'InvalidStateError' || error?.message?.includes('already started')) {
        // Recognition might be starting/stopping, check after a brief delay
        setTimeout(() => {
          if (!isListeningRef.current) {
            // Try once more after a short delay
            try {
              recognitionRef.current?.start()
            } catch (e) {
              // If still failing, report error
              const errorMessage = 'Speech recognition is busy. Please try again in a moment.'
              setState((prev) => ({
                ...prev,
                error: errorMessage,
              }))
              if (callbacksRef.current.onError) {
                callbacksRef.current.onError(errorMessage)
              }
            }
          }
        }, 100)
        return
      }
      
      const errorMessage = 'Failed to start speech recognition'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }))
      if (callbacksRef.current.onError) {
        callbacksRef.current.onError(errorMessage)
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return

    try {
      recognitionRef.current.stop()
      isListeningRef.current = false
      setState((prev) => ({
        ...prev,
        isListening: false,
      }))
    } catch (error) {
      // Ignore errors when stopping, but still update state
      isListeningRef.current = false
      setState((prev) => ({
        ...prev,
        isListening: false,
      }))
    }
  }, [])

  const reset = useCallback(() => {
    // Stop if currently listening
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignore errors
      }
    }
    
    isListeningRef.current = false
    setState((prev) => ({
      ...prev,
      isListening: false,
      transcript: '',
      error: null,
    }))
  }, [])

  return {
    ...state,
    startListening,
    stopListening,
    reset,
  }
}

