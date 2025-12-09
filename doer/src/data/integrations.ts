'use client'

export interface IntegrationDefinition {
  key: string
  name: string
  icon: string
  category: string
  descriptionKey: string
  description: string
}

export const integrations: IntegrationDefinition[] = [
  { key: 'appleCalendar', name: 'Apple Calendar', icon: '🍎', category: 'Calendar', descriptionKey: 'pages.integrations.cards.appleCalendar', description: 'DOER reads every Apple Calendar commitment so the AI scheduler can tuck its plan around existing life blocks, while sending AI-generated events back to keep the calendar canonical.' },
  { key: 'outlook', name: 'Outlook', icon: '📅', category: 'Calendar', descriptionKey: 'pages.integrations.cards.outlook', description: 'Outlook meetings flow into DOER so the scheduler carves focused work sprints before each call and pushes any AI-rescheduled slots right back into your inbox-driven agenda.' },
  { key: 'googleCalendar', name: 'Google Calendar', icon: '🗓️', category: 'Calendar', descriptionKey: 'pages.integrations.cards.googleCalendar', description: 'Google Calendar is kept in lockstep with the AI planner—DOER syncs tasks as events, keeps shared links updated, and leans on the calendar feed when juggling availability across teams.' },
  { key: 'todoist', name: 'Todoist', icon: '✔️', category: 'Task Management', descriptionKey: 'pages.integrations.cards.todoist', description: 'DOER drafts tasks into Todoist complete with priorities and due dates, and when Auto-Scheduling reshuffles a session the list is updated so checklists reflect the latest AI thinking.' },
  { key: 'asana', name: 'Asana', icon: '🧭', category: 'Task Management', descriptionKey: 'pages.integrations.cards.asana', description: 'Map AI plan tasks into Asana projects so DOER can align its auto-scheduler with project timelines and let collaborators see which AI-scheduled task unlocks the next sprint.' },
  { key: 'trello', name: 'Trello', icon: '🟩', category: 'Task Management', descriptionKey: 'pages.integrations.cards.trello', description: 'Every task DOER generates becomes a Trello card with the estimated effort and scheduled day attached, keeping the Kanban board honest while the planner reorders work as priorities shift.' },
  { key: 'notion', name: 'Notion', icon: '📝', category: 'Knowledge', descriptionKey: 'pages.integrations.cards.notion', description: 'Notion pages become the single source of truth for plan context—DOER uses embedded notes as prompts for new task generations and references them whenever it re-optimizes the AI schedule.' },
  { key: 'evernote', name: 'Evernote', icon: '📓', category: 'Knowledge', descriptionKey: 'pages.integrations.cards.evernote', description: 'Evernote reminders turn into DOER tasks that respect your personal rhythm; the AI scheduler uses those reminders as guardrails when moving work around your day.' },
  { key: 'slack', name: 'Slack', icon: '💬', category: 'Communication', descriptionKey: 'pages.integrations.cards.slack', description: 'Slack delivers rich plan digests, lets you ask DOER for a quick auto-reschedule via slash commands, and broadcasts notifications whenever the AI scheduler reschedules tasks.' },
  { key: 'microsoftTeams', name: 'Microsoft Teams', icon: '💼', category: 'Communication', descriptionKey: 'pages.integrations.cards.microsoftTeams', description: 'Meetings, rooms, and notes from Teams feed the AI scheduler, so DOER balances focus blocks with calls and posts summary cards to the right channels when plans evolve.' },
  { key: 'strava', name: 'Strava', icon: '🏃', category: 'Wellness', descriptionKey: 'pages.integrations.cards.strava', description: 'Strava workouts inform DOER about recovery windows; the AI scheduler keeps high-intensity fitness days from colliding with heavy cognitive work and celebrates completion with a plan update.' },
  { key: 'appleHealth', name: 'Apple Health', icon: '❤️', category: 'Wellness', descriptionKey: 'pages.integrations.cards.appleHealth', description: 'Apple Health signals (sleep, heart rate, activity) teach the scheduler when to back off demanding tasks or when to drop in extra stretch goals, keeping DOER’s rhythm in sync with your energy.' },
  { key: 'coursera', name: 'Coursera', icon: '🎓', category: 'Learning', descriptionKey: 'pages.integrations.cards.coursera', description: 'DOER watches Coursera progress and spins up pre-filled plan prompts for the next lesson, blocking study sessions with precise durations so AI scheduling never forgets your learning goals.' },
  { key: 'udemy', name: 'Udemy', icon: '📖', category: 'Learning', descriptionKey: 'pages.integrations.cards.udemy', description: 'Udemy course outlines become task stacks—DOER Auto-Schedules review time, pushes progress markers to your plan, and reminds you via the scheduler when the next module is due.' },
]

