'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, HelpCircle } from 'lucide-react'
import { Button } from './Button'
import { Card, CardContent, CardHeader, CardTitle } from './Card'

interface ClarificationModalProps {
  isOpen: boolean
  questions: string[]
  onSubmit: (answers: Record<string, string>) => void
  onSkip: () => void
  onClose: () => void
}

export function ClarificationModal({
  isOpen,
  questions,
  onSubmit,
  onSkip,
  onClose
}: ClarificationModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize answers when questions change
  useEffect(() => {
    const initialAnswers: Record<string, string> = {}
    questions.forEach((_, index) => {
      initialAnswers[index.toString()] = ''
    })
    setAnswers(initialAnswers)
  }, [questions])

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex.toString()]: value
    }))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      // Validate that all questions are answered
      const unansweredQuestions = questions.filter((_, index) => 
        !answers[index.toString()]?.trim()
      )
      
      if (unansweredQuestions.length > 0) {
        alert('Please answer all questions before continuing.')
        return
      }

      // Convert answers to the expected format
      const formattedAnswers: Record<string, string> = {}
      questions.forEach((question, index) => {
        formattedAnswers[`clarification_${index + 1}`] = answers[index.toString()]
      })

      onSubmit(formattedAnswers)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    onSkip()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl mx-4"
        >
          <Card className="bg-white/5 border-white/10 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#ff7f00]/20 rounded-lg">
                  <HelpCircle className="h-5 w-5 text-[#ff7f00]" />
                </div>
                <div>
                  <CardTitle className="text-[#d7d2cb] text-xl">
                    Help Us Understand Your Goal
                  </CardTitle>
                  <p className="text-[#d7d2cb]/70 text-sm mt-1">
                    A few quick questions to create the perfect plan for you
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-6">
              {questions.map((question, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-2"
                >
                  <label className="block text-sm font-medium text-[#d7d2cb]">
                    {question}
                  </label>
                  <textarea
                    value={answers[index.toString()] || ''}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-md text-[#d7d2cb] placeholder-[#d7d2cb]/60 focus:outline-none focus:ring-2 focus:ring-[#ff7f00] focus:border-transparent resize-none"
                    rows={3}
                  />
                </motion.div>
              ))}

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="text-[#d7d2cb]/60 hover:text-[#d7d2cb] hover:bg-white/10"
                >
                  Skip Questions
                </Button>
                
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-[#ff7f00] hover:bg-[#ff7f00]/90 text-white shadow-lg shadow-[#ff7f00]/20"
                >
                  {isSubmitting ? 'Creating Plan...' : 'Continue'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}































