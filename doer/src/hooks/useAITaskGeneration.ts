import { useState, useCallback } from 'react'

interface AITaskRequest {
  description: string
  constrainedDate?: string
  constrainedTime?: string
  followUpData?: any
  timeFormat?: '12h' | '24h'
}

interface AITaskResponse {
  name: string
  details: string
  duration_minutes: number
  suggested_date?: string
  suggested_time: string
  suggested_end_time: string
  reasoning: string
  isRecurring?: boolean
  isIndefinite?: boolean
  recurrenceDays?: number[]
  recurrenceStartDate?: string
  recurrenceEndDate?: string
}

interface AITaskFollowUp {
  isRecurring: true
  followUpQuestion: string
  detectedPattern: string
  taskName: string
}

interface UseAITaskGenerationReturn {
  generateTask: (request: AITaskRequest) => Promise<AITaskResponse | AITaskFollowUp | null>
  isLoading: boolean
  error: string | null
  clearError: () => void
}

export function useAITaskGeneration(): UseAITaskGenerationReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateTask = useCallback(async (request: AITaskRequest): Promise<AITaskResponse | AITaskFollowUp | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/tasks/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })

      const data = await response.json()

      if (!response.ok) {
        // Preserve the error code for better error handling in UI
        // Check both error and message fields
        const errorCode = data.error || data.message || 'Failed to generate task'
        throw new Error(errorCode)
      }

      if (!data.success) {
        throw new Error('Invalid response from AI service')
      }

      // Handle recurring task follow-up
      if (data.isRecurring && data.followUpQuestion) {
        return {
          isRecurring: true,
          followUpQuestion: data.followUpQuestion,
          detectedPattern: data.detectedPattern,
          taskName: data.taskName
        }
      }

      // Handle regular task or recurring task with full details
      if (!data.task) {
        throw new Error('No task data received from AI service')
      }

      return data.task
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('AI task generation error:', err)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    generateTask,
    isLoading,
    error,
    clearError,
  }
}
