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

      if (finalTranscript && onResult) {
        onResult(finalTranscript.trim())
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
          setState((prev) => ({
            ...prev,
            isListening: false,
          }))
          return
        default:
          errorMessage = `Speech recognition error: ${event.error}`
      }

      setState((prev) => ({
        ...prev,
        isListening: false,
        error: errorMessage,
      }))

      if (onError) {
        onError(errorMessage)
      }
    }

    recognition.onend = () => {
      setState((prev) => ({
        ...prev,
        isListening: false,
      }))
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
  }, [continuous, interimResults, lang, onResult, onError])

  const startListening = useCallback(() => {
    if (!recognitionRef.current || state.isListening) return

    try {
      recognitionRef.current.start()
    } catch (error) {
      const errorMessage = 'Failed to start speech recognition'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }))
      if (onError) {
        onError(errorMessage)
      }
    }
  }, [state.isListening, onError])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !state.isListening) return

    try {
      recognitionRef.current.stop()
    } catch (error) {
      // Ignore errors when stopping
    }
  }, [state.isListening])

  const reset = useCallback(() => {
    stopListening()
    setState((prev) => ({
      ...prev,
      isListening: false,
      transcript: '',
      error: null,
    }))
  }, [stopListening])

  return {
    ...state,
    startListening,
    stopListening,
    reset,
  }
}

