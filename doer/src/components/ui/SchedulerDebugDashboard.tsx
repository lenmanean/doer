'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card'
import { Badge } from './Badge'
import { Button } from './Button'
import { runAllSchedulerTests } from '@/lib/scheduler-tests'

interface SchedulerDebugDashboardProps {
  isOpen: boolean
  onClose: () => void
}

export function SchedulerDebugDashboard({ isOpen, onClose }: SchedulerDebugDashboardProps) {
  const [testResults, setTestResults] = useState<{
    passed: number
    failed: number
    details: string[]
  } | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  const runTests = async () => {
    setIsRunning(true)
    setTestResults(null)
    
    // Capture console output
    const originalLog = console.log
    const originalError = console.error
    const logs: string[] = []
    
    console.log = (...args) => {
      logs.push(args.join(' '))
      originalLog(...args)
    }
    
    console.error = (...args) => {
      logs.push(`ERROR: ${args.join(' ')}`)
      originalError(...args)
    }
    
    try {
      const passed = runAllSchedulerTests()
      setTestResults({
        passed: passed ? 4 : 0,
        failed: passed ? 0 : 4,
        details: logs
      })
    } catch (error) {
      setTestResults({
        passed: 0,
        failed: 4,
        details: [...logs, `FATAL ERROR: ${error}`]
      })
    } finally {
      console.log = originalLog
      console.error = originalError
      setIsRunning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduler Health Dashboard</CardTitle>
              <CardDescription>
                Monitor scheduler health and prevent known issues
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={runTests} 
              disabled={isRunning}
              className="flex-1"
            >
              {isRunning ? 'Running Tests...' : 'Run Health Check'}
            </Button>
          </div>

          {testResults && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <Badge variant={testResults.passed > 0 ? 'default' : 'destructive'}>
                  {testResults.passed} Passed
                </Badge>
                <Badge variant={testResults.failed > 0 ? 'destructive' : 'default'}>
                  {testResults.failed} Failed
                </Badge>
              </div>

              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg max-h-60 overflow-y-auto">
                <h4 className="font-semibold mb-2">Test Output:</h4>
                <pre className="text-sm whitespace-pre-wrap">
                  {testResults.details.join('\n')}
                </pre>
              </div>

              {testResults.failed === 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    ✅ Scheduler is Healthy
                  </h4>
                  <p className="text-green-700 dark:text-green-300 text-sm">
                    All tests passed. It's safe to create new plans.
                  </p>
                </div>
              )}

              {testResults.failed > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                    ⚠️ Scheduler Issues Detected
                  </h4>
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    {testResults.failed} test(s) failed. Please fix issues before creating new plans.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-2">What This Tests:</h4>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <li>• Daily capacity calculation (prevents dailyCapacity: 0 bug)</li>
              <li>• Task positioning logic (prevents CSS positioning bugs)</li>
              <li>• Task grouping algorithm (prevents complex grouping issues)</li>
              <li>• Invalid input handling (prevents crashes)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
