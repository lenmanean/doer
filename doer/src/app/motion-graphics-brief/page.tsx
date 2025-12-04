'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { FadeInWrapper } from '@/components/ui/FadeInWrapper'

export default function MotionGraphicsBriefPage() {
  const [downloadingLogo, setDownloadingLogo] = useState(false)
  const [downloadingSwatches, setDownloadingSwatches] = useState(false)

  const handleDownloadLogo = () => {
    setDownloadingLogo(true)
    const link = document.createElement('a')
    link.href = '/images_videos/vyrstudio/logo_transparent.png'
    link.download = 'doer-logo-transparent.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => setDownloadingLogo(false), 500)
  }

  const handleDownloadSwatches = () => {
    setDownloadingSwatches(true)
    const link = document.createElement('a')
    link.href = '/images_videos/vyrstudio/color_swatches.png'
    link.download = 'doer-color-swatches.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => setDownloadingSwatches(false), 500)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header Section */}
        <FadeInWrapper>
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              Motion Graphics Brief
            </h1>
            <p className="text-xl text-[#d7d2cb]/80">
              DOER.AI - Internal Brief Document
            </p>
          </div>
        </FadeInWrapper>

        {/* Target Audience & Market Context */}
        <FadeInWrapper delay={0.1}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-white">Target Audience & Market Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[#d7d2cb]">
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Primary Focus:</strong> New Year's resolution season and consumers seeking structured goal planning for their aspirations and ambitions for the upcoming year.
              </p>
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Target Audience:</strong> Achievement-oriented individuals who want to transform their goals into actionable, structured plans. These are people transitioning from intention to execution, those who don't just want to plan but want to actually achieve their goals.
              </p>
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Market Context:</strong> The New Year brings a natural momentum for goal-setting. Consumers are actively seeking tools and solutions that can help them create comprehensive plans for their 2026 goals and aspirations. DOER.AI positions itself as the platform that bridges the gap between setting goals and executing them.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Main Points to Focus On */}
        <FadeInWrapper delay={0.2}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-white">Main Points to Focus On</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 text-[#d7d2cb]">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">AI-Powered Plan Generation</h3>
                  <p className="text-lg leading-relaxed">
                    DOER transforms written goals into structured, actionable plans with tasks. Users simply describe their goal, answer a few clarification questions, and receive a personalized roadmap.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Smart Scheduling</h3>
                  <p className="text-lg leading-relaxed">
                    The platform automatically schedules tasks based on user availability, work hours, and existing calendar commitments. The AI scheduler respects busy slots, time off, and optimal productivity patterns.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Progress Tracking & Analytics</h3>
                  <p className="text-lg leading-relaxed mb-3">
                    Real-time progress monitoring with health scores, visual indicators, and comprehensive analytics. The platform tracks progress, consistency, and efficiency metrics, surfacing trends and insights to help users understand their patterns and optimize their approach.
                  </p>
                  <p className="text-lg leading-relaxed">
                    Users can see their advancement at a glance through intuitive dashboards that display plan health, completion rates, and performance trends. The system provides actionable insights to help users stay on track and identify areas for improvement.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Calendar & Task Integrations</h3>
                  <p className="text-lg leading-relaxed mb-3">
                    Seamless bidirectional integration with 14+ tools including Google Calendar, Outlook, Apple Calendar, Todoist, Asana, Trello, Notion, Evernote, Slack, Microsoft Teams, Strava, Apple Health, Coursera, and Udemy.
                  </p>
                  <p className="text-lg leading-relaxed mb-3">
                    <strong className="text-white">How Integrations Work:</strong> Each connector keeps the AI scheduler aware of calendars, tasks, and energy levels. The system reads existing commitments to avoid conflicts, sends AI-generated events back to connected calendars, and updates task lists when the scheduler reshuffles work. For example:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-lg">
                    <li>Calendar integrations (Google, Outlook, Apple) sync checkpoints as events and respect existing meetings when scheduling</li>
                    <li>Task managers (Todoist, Asana, Trello) receive DOER tasks with priorities and due dates, updating automatically when AI reschedules</li>
                    <li>Communication tools (Slack, Teams) deliver plan digests and notifications when schedules change</li>
                    <li>Health apps (Strava, Apple Health) inform the scheduler about recovery windows and energy levels</li>
                    <li>Learning platforms (Coursera, Udemy) track progress and auto-schedule study sessions</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Goal-to-Execution Flow</h3>
                  <p className="text-lg leading-relaxed mb-3">
                    Simple, streamlined onboarding where users enter a goal description, answer a few AI-generated clarification questions (if needed), select a start date, and receive a personalized roadmap with tasks and schedules.
                  </p>
                  <p className="text-lg leading-relaxed">
                    The experience is designed to be visual and motivating rather than technical. Users can preview and refine their AI-generated plan before activation, adjusting dates or tasks as needed. Once activated, the plan becomes a living roadmap that adapts as users progress, with the AI scheduler automatically managing task placement and conflict resolution.
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Automations & Workflow Integration</h3>
                  <p className="text-lg leading-relaxed">
                    DOER supports automations that trigger from progress updates, keeping stakeholders aligned without manual follow-up. Users can configure automations to sync with their existing tools, ensuring that plan changes are reflected across their entire workflow ecosystem.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Call to Action */}
        <FadeInWrapper delay={0.3}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-white">Call to Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[#d7d2cb]">
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Primary CTA:</strong> Encourage users to start planning their New Year's goals and turn their resolutions into actionable plans.
              </p>
              <p className="text-lg leading-relaxed">
                <strong className="text-white">Key Messaging:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4 text-lg">
                <li>"Turn your goals into reality"</li>
                <li>"From intention to execution"</li>
                <li>"Start planning your 2026 goals today"</li>
                <li>"Turn your New Year's resolutions into actionable plans"</li>
              </ul>
              <p className="text-lg leading-relaxed">
                The messaging should emphasize the New Year's momentum and focus on goal achievement and execution. The tone should be empowering and action-oriented, positioning DOER as the bridge between setting goals and actually achieving them.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Branding Assets */}
        <FadeInWrapper delay={0.4}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-white">Branding Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Logo Section */}
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-white">Logo</h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 bg-white/5 rounded-lg border border-white/10">
                  <div className="relative w-64 h-64 flex-shrink-0 bg-transparent">
                    <Image
                      src="/images_videos/vyrstudio/logo_transparent.png"
                      alt="DOER Logo - Transparent"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <p className="text-[#d7d2cb]">
                      <strong className="text-white">Transparent Logo</strong>
                    </p>
                    <Button
                      onClick={handleDownloadLogo}
                      disabled={downloadingLogo}
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingLogo ? 'Downloading...' : 'Download Transparent Logo'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Color Swatches Section */}
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-white">Color Palette</h3>
                <div className="p-6 bg-white/5 rounded-lg border border-white/10 space-y-6">
                  <div className="relative w-full max-w-md mx-auto aspect-square">
                    <Image
                      src="/images_videos/vyrstudio/color_swatches.png"
                      alt="DOER Color Swatches"
                      fill
                      className="object-contain"
                      priority
                    />
                  </div>
                  <div className="space-y-3">
                    <Button
                      onClick={handleDownloadSwatches}
                      disabled={downloadingSwatches}
                      variant="primary"
                      size="lg"
                      className="w-full sm:w-auto"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingSwatches ? 'Downloading...' : 'Download Color Swatches'}
                    </Button>
                    <div className="space-y-2 text-[#d7d2cb]">
                      <p className="text-lg font-semibold text-white">Color Values:</p>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li><strong className="text-white">Orange:</strong> #f97316 (Primary brand color)</li>
                        <li><strong className="text-white">Black:</strong> #0a0a0a</li>
                        <li><strong className="text-white">Grey:</strong> #161616 (Charcoal)</li>
                        <li><strong className="text-white">Navy Blue:</strong> #111827</li>
                        <li><strong className="text-white">Light Gray:</strong> #454545</li>
                        <li><strong className="text-white">Red:</strong> #591717</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Typography Section */}
              <div className="space-y-4">
                <h3 className="text-2xl font-semibold text-white">Typography</h3>
                <div className="p-6 bg-white/5 rounded-lg border border-white/10 space-y-4 text-[#d7d2cb]">
                  <div>
                    <p className="text-lg font-semibold text-white mb-2">Primary Font:</p>
                    <p className="text-lg">Inter (from Google Fonts)</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white mb-2">Available Font Weights:</p>
                    <ul className="list-disc list-inside space-y-1 ml-4">
                      <li>300 (Light)</li>
                      <li>400 (Regular)</li>
                      <li>500 (Medium)</li>
                      <li>600 (Semi Bold)</li>
                      <li>700 (Bold)</li>
                      <li>800 (Extra Bold)</li>
                      <li>900 (Black)</li>
                    </ul>
                  </div>
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-lg font-semibold text-white mb-2">Font Import:</p>
                    <code className="block p-3 bg-black/30 rounded text-sm text-[#d7d2cb] font-mono">
                      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                    </code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeInWrapper>

        {/* Additional Notes */}
        <FadeInWrapper delay={0.5}>
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl text-white">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[#d7d2cb]">
              <p className="text-lg leading-relaxed">
                All feature descriptions and functionality mentioned in this brief are accurate and reflect the actual implementation of DOER.AI. No features have been fabricated or exaggerated.
              </p>
              <p className="text-lg leading-relaxed">
                The motion graphics should emphasize the transformation from goal-setting to execution, with particular focus on the New Year's momentum and the journey from intention to achievement.
              </p>
              <p className="text-lg leading-relaxed">
                Visual style should align with the clean, modern aesthetic of the platform—professional yet approachable, with the orange (#f97316) as the primary accent color throughout.
              </p>
            </CardContent>
          </Card>
        </FadeInWrapper>
      </div>
    </div>
  )
}

