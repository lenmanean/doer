'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { PublicHeader } from '@/components/ui/PublicHeader'
import { PublicFooter } from '@/components/ui/PublicFooter'
import { DocumentationSidebar } from '@/components/documentation/DocumentationSidebar'
import { DocumentationSection } from '@/components/documentation/DocumentationSection'
import { CodeBlock } from '@/components/documentation/CodeBlock'
import { ApiExplorer } from '@/components/documentation/ApiExplorer'
import { SearchBar } from '@/components/documentation/SearchBar'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { integrations } from '@/data/integrations'
import Link from 'next/link'
import { 
  Rocket, 
  Target, 
  Calendar, 
  TrendingUp, 
  Zap, 
  BarChart3,
  CheckCircle,
  ExternalLink,
  BookOpen,
  Code,
  Settings,
  AlertCircle
} from 'lucide-react'

export default function DocumentationPage() {
  const t = useTranslations()
  const [searchContent, setSearchContent] = useState<Array<{
    id: string
    title: string
    section: string
    content: string
  }>>([])

  // Build comprehensive search content index
  useEffect(() => {
    const content = [
      // Getting Started
      { id: 'getting-started', title: 'Getting Started', section: 'Getting Started', content: 'Welcome to DOER! Learn how to get started with transforming your goals into actionable plans' },
      { id: 'quick-start', title: 'Quick Start Guide', section: 'Getting Started', content: 'Get up and running with DOER in just 5 minutes. Sign up, enter your goal, answer questions, review your plan, and start tracking progress' },
      { id: 'first-goal', title: 'Creating Your First Goal', section: 'Getting Started', content: 'Learn how to create a goal in DOER. Describe what you want to achieve in plain language and let AI generate a structured plan with tasks' },
      { id: 'understanding-plans', title: 'Understanding Plans', section: 'Getting Started', content: 'A plan is your personalized strategy that breaks down your goal into achievable tasks. Automatically generated based on your goal and timeframe' },
      { id: 'navigation', title: 'Navigation Basics', section: 'Getting Started', content: 'DOER interface overview: Dashboard, Schedule, Plan, and Settings pages' },
      
      // Core Features
      { id: 'core-features', title: 'Core Features', section: 'Core Features', content: 'AI-powered tools to help you achieve your goals efficiently: AI planning, smart scheduling, progress tracking, and analytics' },
      { id: 'ai-planning', title: 'AI Plan Generation', section: 'Core Features', content: 'AI analyzes your goal, breaks it down into actionable tasks, estimates timelines, and creates a personalized roadmap. Includes goal analysis, clarification questions, and plan generation' },
      { id: 'scheduling', title: 'Smart Scheduling & Auto-Rescheduling', section: 'Core Features', content: 'AI-powered scheduler analyzes available time, task priorities, and dependencies to automatically place tasks in your calendar. Includes automatic scheduling and smart rescheduling' },
      { id: 'progress-tracking', title: 'Progress Tracking & Health Scores', section: 'Core Features', content: 'Plan health score (0-100) reflects how well you maintain commitments. Real-time progress updates, task completion tracking, and health score monitoring' },
      { id: 'analytics', title: 'Analytics & Insights', section: 'Core Features', content: 'Understand your patterns and optimize your approach with detailed performance analytics. Completion rate, progress tracking, and health score metrics' },
      
      // Integrations
      { id: 'integrations', title: 'Integrations', section: 'Integrations', content: 'Connect DOER with your favorite tools and services to streamline your planning and goal achievement' },
      { id: 'integrations-overview', title: 'Integrations Overview', section: 'Integrations', content: 'DOER integrates with tools to keep your data synchronized and workflow seamless. Each connector keeps the AI scheduler aware of calendars, tasks, and energy' },
      { id: 'calendar-integrations', title: 'Calendar Integrations', section: 'Integrations', content: 'Connect your calendar so DOER can schedule tasks around existing commitments. Google Calendar, Outlook, and Apple Calendar integrations' },
      { id: 'task-integrations', title: 'Task Management', section: 'Integrations', content: 'Sync tasks with task management tools for a unified workflow. Todoist, Asana, and Trello integrations' },
      { id: 'knowledge-integrations', title: 'Knowledge Tools', section: 'Integrations', content: 'Integrate with note-taking and knowledge management tools. Notion and Evernote integrations' },
      { id: 'communication-integrations', title: 'Communication', section: 'Integrations', content: 'Get notifications and updates in team communication tools. Slack and Microsoft Teams integrations' },
      { id: 'wellness-integrations', title: 'Wellness & Health', section: 'Integrations', content: 'Connect fitness and health tracking apps to help DOER schedule tasks around energy levels. Strava and Apple Health integrations' },
      
      // API Reference
      { id: 'api-reference', title: 'API Reference', section: 'API Reference', content: 'Integrate DOER with your applications using our REST API. All endpoints are authenticated and rate-limited based on subscription plan' },
      { id: 'api-authentication', title: 'API Authentication', section: 'API Reference', content: 'DOER uses API tokens for authentication. Token format: Bearer doer.token_id.token_secret. Get tokens from Settings → API Tokens' },
      { id: 'api-endpoints', title: 'API Endpoints', section: 'API Reference', content: 'API endpoints for plan generation, scheduling, and clarification questions. POST /plans/{goalId}/preflight, POST /plans/{goalId}/generate, POST /plans/{planId}/schedule' },
      { id: 'api-examples', title: 'Code Examples', section: 'API Reference', content: 'Code examples for JavaScript/TypeScript and Python showing how to use the DOER API to generate plans and interact with endpoints' },
      { id: 'api-errors', title: 'Error Handling', section: 'API Reference', content: 'API error format and common error codes: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 429 Rate Limited, 500 Internal Server Error' },
      
      // Tutorials
      { id: 'tutorials', title: 'Tutorials & Examples', section: 'Tutorials', content: 'Learn from real-world examples and best practices for achieving your goals with DOER. Training for a marathon, learning a new skill, starting a business, and best practices' },
      
      // Troubleshooting
      { id: 'troubleshooting', title: 'Troubleshooting', section: 'Troubleshooting', content: 'Common issues and solutions: plan generation taking too long, tasks not showing in calendar, health score decreasing unexpectedly' },
    ]
    setSearchContent(content)
  }, [])

  const navItems = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      children: [
        { id: 'quick-start', title: 'Quick Start Guide' },
        { id: 'first-goal', title: 'Creating Your First Goal' },
        { id: 'understanding-roadmaps', title: 'Understanding Roadmaps' },
        { id: 'navigation', title: 'Navigation Basics' },
      ]
    },
    {
      id: 'core-features',
      title: 'Core Features',
      children: [
        { id: 'ai-planning', title: 'AI Plan Generation' },
        { id: 'scheduling', title: 'Smart Scheduling' },
        { id: 'progress-tracking', title: 'Progress Tracking' },
        { id: 'analytics', title: 'Analytics & Insights' },
      ]
    },
    {
      id: 'integrations',
      title: 'Integrations',
      children: [
        { id: 'integrations-overview', title: 'Overview' },
        { id: 'calendar-integrations', title: 'Calendar Integrations' },
        { id: 'task-integrations', title: 'Task Management' },
        { id: 'knowledge-integrations', title: 'Knowledge Tools' },
        { id: 'communication-integrations', title: 'Communication' },
        { id: 'wellness-integrations', title: 'Wellness & Health' },
      ]
    },
    {
      id: 'api-reference',
      title: 'API Reference',
      children: [
        { id: 'api-authentication', title: 'Authentication' },
        { id: 'api-endpoints', title: 'Endpoints' },
        { id: 'api-examples', title: 'Code Examples' },
        { id: 'api-errors', title: 'Error Handling' },
      ]
    },
    {
      id: 'tutorials',
      title: 'Tutorials & Examples',
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
    },
  ]

  const handleSearchResultClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      const headerOffset = 80
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col transition-colors">
      <PublicHeader />
      
      <main className="flex-1 bg-gray-900 transition-colors">
        {/* Hero Section */}
        <div className="border-b border-gray-800 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-4">
                {t('pages.documentation.title')}
              </h1>
              <p className="text-xl text-slate-300 mb-6 max-w-3xl mx-auto break-words">
                {t('pages.documentation.description')}
              </p>
              <div className="flex justify-center">
                <SearchBar onResultClick={handleSearchResultClick} searchContent={searchContent} />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
          <div className="flex flex-col md:flex-row gap-4 md:gap-8">
            {/* Sidebar */}
            <DocumentationSidebar items={navItems} />

            {/* Content */}
            <div className="flex-1 max-w-4xl min-w-0 break-words overflow-wrap-anywhere">
              {/* Getting Started */}
              <DocumentationSection id="getting-started" title="Getting Started" level={1}>
                <p className="text-lg text-slate-300 mb-8 break-words overflow-wrap-anywhere">
                  Welcome to DOER! This guide will help you get started with transforming your goals into actionable plans.
                </p>

                <DocumentationSection id="quick-start" title="Quick Start Guide" level={2}>
                  <div className="space-y-4">
                    <p>Get up and running with DOER in just 5 minutes:</p>
                    <ol className="list-decimal list-inside space-y-3 text-slate-300">
                      <li>Sign up for a free account at <Link href="/auth/signup" className="text-orange-500 hover:underline break-all sm:break-normal">usedoer.com/auth/signup</Link></li>
                      <li>Enter your goal in natural language - anything from "Learn to play guitar" to "Run a marathon"</li>
                      <li>Answer a few clarification questions to help our AI understand your context</li>
                      <li>Review and customize your AI-generated plan with tasks</li>
                      <li>Start working on your tasks and track your progress in real-time</li>
                    </ol>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="first-goal" title="Creating Your First Goal" level={2}>
                  <div className="space-y-4">
                    <p>
                      Creating a goal in DOER is simple. Just describe what you want to achieve in plain language. 
                      Our AI will analyze your goal and generate a structured plan with tasks.
                    </p>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Example Goals</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <p className="text-sm">• "Learn to cook Tikka Masala"</p>
                        <p className="text-sm">• "Create a study plan for my AP Physics exam this Friday"</p>
                        <p className="text-sm">• "Organize my closet this weekend"</p>
                        <p className="text-sm">• "Start a blog and publish weekly articles"</p>
                      </CardContent>
                    </Card>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="understanding-plans" title="Understanding Plans" level={2}>
                  <div className="space-y-4">
                    <p>
                      A plan is your personalized strategy that breaks down your goal into achievable tasks. 
                      It's automatically generated based on your goal and timeframe, helping you stay on track every step of the way.
                    </p>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          Tasks
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-slate-400">
                          Actionable items that help you achieve your goal. Each task is scheduled on your calendar with estimated duration and priority.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="navigation" title="Navigation Basics" level={2}>
                  <div className="space-y-4">
                    <p>DOER's interface is designed to be intuitive and easy to navigate:</p>
                    <ul className="list-disc list-inside space-y-2 text-slate-300">
                      <li><strong>Dashboard:</strong> View your current goal, progress, and upcoming tasks</li>
                      <li><strong>Schedule:</strong> See your tasks organized by day and time</li>
                      <li><strong>Plan:</strong> Visual timeline showing your tasks and progress</li>
                      <li><strong>Settings:</strong> Configure your preferences, integrations, and account settings</li>
                    </ul>
                  </div>
                </DocumentationSection>
              </DocumentationSection>

              {/* Core Features */}
              <DocumentationSection id="core-features" title="Core Features" level={1}>
                <p className="text-lg text-slate-300 mb-8">
                  DOER provides powerful AI-powered tools to help you achieve your goals efficiently.
                </p>

                <DocumentationSection id="ai-planning" title="AI Plan Generation" level={2}>
                  <div className="space-y-4">
                    <p>
                      DOER uses advanced AI to analyze your goal, break it down into actionable tasks, estimate timelines, 
                      and create a personalized roadmap. The AI considers complexity, dependencies, and realistic scheduling 
                      to give you an achievable plan.
                    </p>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">How It Works</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <h4 className="font-semibold mb-1">1. Goal Analysis</h4>
                          <p className="text-sm text-slate-400">
                            Our AI analyzes your goal description to understand scope, complexity, and requirements.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">2. Clarification Questions</h4>
                          <p className="text-sm text-slate-400">
                            When needed, DOER asks targeted questions to better understand your context and constraints.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-1">3. Plan Generation</h4>
                          <p className="text-sm text-slate-400">
                            The AI creates a structured plan with tasks, dependencies, and timelines.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="scheduling" title="Smart Scheduling & Auto-Rescheduling" level={2}>
                  <div className="space-y-4">
                    <p>
                      Our AI-powered scheduler analyzes your available time, task priorities, and dependencies to automatically 
                      place tasks in your calendar. It considers your work hours, existing commitments, and optimal productivity patterns.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Automatic Scheduling</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-400">
                            Tasks are automatically scheduled based on dependencies, estimated duration, and your availability preferences.
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Smart Rescheduling</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-slate-400">
                            When priorities shift or conflicts arise, DOER automatically reschedules tasks while respecting dependencies.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="progress-tracking" title="Progress Tracking & Health Scores" level={2}>
                  <div className="space-y-4">
                    <p>
                      Your plan health is a dynamic score (0-100) that reflects how well you're maintaining your commitments. 
                      It starts at 100 and decreases when you miss scheduled tasks. Completing tasks on time keeps your health high.
                    </p>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Tracking Features</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm">Real-time progress updates</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm">Task completion tracking</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm">Health score monitoring</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="analytics" title="Analytics & Insights" level={2}>
                  <div className="space-y-4">
                    <p>
                      Understand your patterns and optimize your approach with detailed performance analytics. 
                      DOER surfaces trends, risks, and wins so you can respond proactively.
                    </p>
                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Completion Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-orange-500">85%</p>
                          <p className="text-xs text-slate-400 mt-1">Tasks completed on time</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Progress</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-green-500">42%</p>
                          <p className="text-xs text-slate-400 mt-1">Of total goal achieved</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Health Score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold text-blue-500">92</p>
                          <p className="text-xs text-slate-400 mt-1">Overall plan health</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </DocumentationSection>
              </DocumentationSection>

              {/* Integrations */}
              <DocumentationSection id="integrations" title="Integrations" level={1}>
                <p className="text-lg text-slate-300 mb-8">
                  Connect DOER with your favorite tools and services to streamline your planning and goal achievement.
                </p>

                <DocumentationSection id="integrations-overview" title="Overview" level={2}>
                  <p>
                    DOER integrates with a wide range of tools to keep your data synchronized and your workflow seamless. 
                    Each connector keeps the AI scheduler aware of your calendars, tasks, and energy so every update is reflected instantly.
                  </p>
                </DocumentationSection>

                <DocumentationSection id="calendar-integrations" title="Calendar Integrations" level={2}>
                  <div className="space-y-4">
                    <p>
                      Connect your calendar so DOER can schedule tasks around existing commitments and sync tasks as events.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {integrations.filter(i => i.category === 'Calendar').map(integration => (
                        <Card key={integration.key}>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-2xl">{integration.icon}</span>
                              {integration.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-400">
                              {integration.description}
                            </p>
                            <Button variant="outline" size="sm" className="mt-4">
                              Connect <ExternalLink className="w-3 h-3 ml-1" />
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="task-integrations" title="Task Management" level={2}>
                  <div className="space-y-4">
                    <p>
                      Sync tasks with your favorite task management tools for a unified workflow.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {integrations.filter(i => i.category === 'Task Management').map(integration => (
                        <Card key={integration.key}>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-2xl">{integration.icon}</span>
                              {integration.name}
                              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-400">
                              {integration.description}
                            </p>
                            <Button variant="outline" size="sm" className="mt-4" disabled>
                              Coming Soon
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="knowledge-integrations" title="Knowledge Tools" level={2}>
                  <div className="space-y-4">
                    <p>
                      Integrate with note-taking and knowledge management tools to keep your plans in sync with your notes.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {integrations.filter(i => i.category === 'Knowledge').map(integration => (
                        <Card key={integration.key}>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-2xl">{integration.icon}</span>
                              {integration.name}
                              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-400">
                              {integration.description}
                            </p>
                            <Button variant="outline" size="sm" className="mt-4" disabled>
                              Coming Soon
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="communication-integrations" title="Communication" level={2}>
                  <div className="space-y-4">
                    <p>
                      Get notifications and updates in your team communication tools.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {integrations.filter(i => i.category === 'Communication').map(integration => (
                        <Card key={integration.key}>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-2xl">{integration.icon}</span>
                              {integration.name}
                              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-400">
                              {integration.description}
                            </p>
                            <Button variant="outline" size="sm" className="mt-4" disabled>
                              Coming Soon
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="wellness-integrations" title="Wellness & Health" level={2}>
                  <div className="space-y-4">
                    <p>
                      Connect fitness and health tracking apps to help DOER schedule tasks around your energy levels and recovery.
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                      {integrations.filter(i => i.category === 'Wellness').map(integration => (
                        <Card key={integration.key}>
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="text-2xl">{integration.icon}</span>
                              {integration.name}
                              <Badge variant="outline" className="ml-auto">Coming Soon</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-slate-400">
                              {integration.description}
                            </p>
                            <Button variant="outline" size="sm" className="mt-4" disabled>
                              Coming Soon
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </DocumentationSection>
              </DocumentationSection>

              {/* API Reference */}
              <DocumentationSection id="api-reference" title="API Reference" level={1}>
                <p className="text-lg text-slate-300 mb-8">
                  Integrate DOER with your applications using our REST API. All endpoints are authenticated and rate-limited based on your subscription plan.
                </p>

                <DocumentationSection id="api-authentication" title="Authentication" level={2}>
                  <div className="space-y-4">
                    <p>
                      DOER uses API tokens for authentication. Tokens are scoped to your user account and inherit your subscription limits.
                    </p>
                    <p>
                      <strong>Token Format:</strong> <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">Bearer doer.&lt;token_id&gt;.&lt;token_secret&gt;</code>
                    </p>
                    <CodeBlock
                      code={`// Example: Using API token in a request
fetch('https://usedoer.com/api/plans/{goalId}/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer doer.token_id.token_secret',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    goal_text: "Run a marathon",
    deadline: "2026-05-01",
    weekly_hours: 6
  })
})`}
                      language="javascript"
                    />
                    <p>
                      Get your API token from <Link href="/settings/api-tokens" className="text-orange-500 hover:underline">Settings → API Tokens</Link>
                    </p>
                  </div>
                </DocumentationSection>

                <DocumentationSection id="api-endpoints" title="Endpoints" level={2}>
                  <div className="space-y-6">
                    <ApiExplorer
                      endpoint={{
                        method: 'POST',
                        path: '/plans/{goalId}/preflight',
                        summary: 'Generate clarification questions for a goal',
                        description: 'Analyzes a goal and returns minimal clarifying questions needed before plan generation',
                        example: {
                          request: JSON.stringify({
                            goal_text: "Scuba dive in Colombia before I turn 23",
                            deadline: "2026-01-15",
                            weekly_hours: 5,
                            budget_cents: 200000
                          }, null, 2)
                        }
                      }}
                    />

                    <ApiExplorer
                      endpoint={{
                        method: 'POST',
                        path: '/plans/{goalId}/generate',
                        summary: 'Generate a plan draft for a goal',
                        description: 'Creates a structured plan with tasks based on goal requirements',
                        example: {
                          request: JSON.stringify({
                            goal_text: "Run a marathon",
                            deadline: "2026-05-01",
                            weekly_hours: 6,
                            budget_cents: 15000,
                            answers: {},
                            constraints: {
                              max_total_tasks: 40
                            }
                          }, null, 2)
                        }
                      }}
                    />

                    <ApiExplorer
                      endpoint={{
                        method: 'POST',
                        path: '/plans/{planId}/schedule',
                        summary: 'Schedule tasks in a plan',
                        description: 'Maps plan tasks to calendar days with dependency resolution',
                        example: {
                          request: JSON.stringify({
                            start_date: "2025-01-01",
                            deadline: "2026-05-01",
                            weekly_hours: 6,
                            timezone: "America/Los_Angeles"
                          }, null, 2)
                        }
                      }}
                    />
                  </div>
                </DocumentationSection>

                <DocumentationSection id="api-examples" title="Code Examples" level={2}>
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold">JavaScript/TypeScript</h3>
                    <CodeBlock
                      code={`import { DOERClient } from '@doer/sdk'

const client = new DOERClient({
  apiToken: 'doer.your_token_id.your_token_secret',
  baseUrl: 'https://usedoer.com/api'
})

// Generate a plan
const plan = await client.plans.generate({
  goalId: 'your-goal-id',
  goal_text: "Learn to play guitar",
  deadline: "2026-12-31",
  weekly_hours: 5
})

console.log(plan)`}
                      language="typescript"
                    />

                    <h3 className="text-xl font-semibold mt-6">Python</h3>
                    <CodeBlock
                      code={`import requests

headers = {
    'Authorization': 'Bearer doer.your_token_id.your_token_secret',
    'Content-Type': 'application/json'
}

response = requests.post(
    'https://usedoer.com/api/plans/goal-id/generate',
    headers=headers,
    json={
        'goal_text': 'Learn to play guitar',
        'deadline': '2026-12-31',
        'weekly_hours': 5
    }
)

plan = response.json()
print(plan)`}
                      language="python"
                    />
                  </div>
                </DocumentationSection>

                <DocumentationSection id="api-errors" title="Error Handling" level={2}>
                  <div className="space-y-4">
                    <p>All errors follow a consistent format:</p>
                    <CodeBlock
                      code={`{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "timestamp": "2025-01-21T12:30:00Z",
  "path": "/plans/123/generate",
  "method": "POST"
}`}
                      language="json"
                    />
                    <div className="space-y-2">
                      <h4 className="font-semibold">Common Error Codes:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-slate-300">
                        <li><code className="px-1 py-0.5 bg-gray-800 rounded">400</code> - Bad Request (invalid input)</li>
                        <li><code className="px-1 py-0.5 bg-gray-800 rounded">401</code> - Unauthorized (missing or invalid token)</li>
                        <li><code className="px-1 py-0.5 bg-gray-800 rounded">403</code> - Forbidden (insufficient permissions)</li>
                        <li><code className="px-1 py-0.5 bg-gray-800 rounded">429</code> - Rate Limited (too many requests)</li>
                        <li><code className="px-1 py-0.5 bg-gray-800 rounded">500</code> - Internal Server Error</li>
                      </ul>
                    </div>
                  </div>
                </DocumentationSection>
              </DocumentationSection>

              {/* Tutorials */}
              <DocumentationSection id="tutorials" title="Tutorials & Examples" level={1}>
                <p className="text-lg text-slate-300 mb-8">
                  Learn from real-world examples and best practices for achieving your goals with DOER.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Training for a Marathon</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        A complete guide to using DOER to create a structured marathon training plan with progressive tasks.
                      </p>
                      <Button variant="outline" size="sm">
                        Read Tutorial <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Learning a New Skill</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        Break down complex learning goals into manageable tasks and track your progress over time.
                      </p>
                      <Button variant="outline" size="sm">
                        Read Tutorial <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Starting a Business</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        Use DOER to plan your business launch with dependencies, tasks, and timeline management.
                      </p>
                      <Button variant="outline" size="sm">
                        Read Tutorial <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400 mb-4">
                        Tips and tricks for getting the most out of DOER, from goal setting to maintaining momentum.
                      </p>
                      <Button variant="outline" size="sm">
                        Read Guide <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </DocumentationSection>

              {/* Troubleshooting */}
              <DocumentationSection id="troubleshooting" title="Troubleshooting" level={1}>
                <p className="text-lg text-slate-300 mb-8">
                  Common issues and solutions to help you get the most out of DOER.
                </p>
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        Plan generation is taking too long
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400">
                        Complex goals may take a few minutes to process. If your plan hasn't generated after 5 minutes, 
                        try simplifying your goal description or checking your internet connection. You can also try refreshing the page.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        Tasks aren't showing up in my calendar
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400">
                        Make sure your calendar integration is connected and has the necessary permissions. 
                        Go to Settings → Integrations to verify your calendar connection status.
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                        My health score is decreasing unexpectedly
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-400">
                        Your health score decreases when you miss scheduled tasks. To improve it, focus on completing 
                        your daily tasks consistently. You can also adjust your schedule if tasks are too ambitious.
                      </p>
                    </CardContent>
                  </Card>
                </div>
                <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-100">
                    <strong>Still need help?</strong> Check out our{' '}
                    <Link href="/help" className="underline hover:no-underline">
                      Help Center
                    </Link>{' '}
                    for more FAQs, or join our{' '}
                    <a href="https://discord.gg/JfPXMjCzbN" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                      Discord community
                    </a>{' '}
                    for support.
                  </p>
                </div>
              </DocumentationSection>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
