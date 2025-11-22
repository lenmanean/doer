'use client'

export interface IntegrationDefinition {
  key: string
  name: string
  icon: string
  category: string
  descriptionKey: string
}

export const integrations: IntegrationDefinition[] = [
  { key: 'appleCalendar', name: 'Apple Calendar', icon: '🍎', category: 'Calendar', descriptionKey: 'pages.integrations.cards.appleCalendar' },
  { key: 'outlook', name: 'Outlook', icon: '📅', category: 'Calendar', descriptionKey: 'pages.integrations.cards.outlook' },
  { key: 'googleCalendar', name: 'Google Calendar', icon: '🗓️', category: 'Calendar', descriptionKey: 'pages.integrations.cards.googleCalendar' },
  { key: 'todoist', name: 'Todoist', icon: '✔️', category: 'Task Management', descriptionKey: 'pages.integrations.cards.todoist' },
  { key: 'asana', name: 'Asana', icon: '🧭', category: 'Task Management', descriptionKey: 'pages.integrations.cards.asana' },
  { key: 'trello', name: 'Trello', icon: '🟩', category: 'Task Management', descriptionKey: 'pages.integrations.cards.trello' },
  { key: 'notion', name: 'Notion', icon: '📝', category: 'Knowledge', descriptionKey: 'pages.integrations.cards.notion' },
  { key: 'evernote', name: 'Evernote', icon: '📓', category: 'Knowledge', descriptionKey: 'pages.integrations.cards.evernote' },
  { key: 'slack', name: 'Slack', icon: '💬', category: 'Communication', descriptionKey: 'pages.integrations.cards.slack' },
  { key: 'microsoftTeams', name: 'Microsoft Teams', icon: '💼', category: 'Communication', descriptionKey: 'pages.integrations.cards.microsoftTeams' },
  { key: 'strava', name: 'Strava', icon: '🏃', category: 'Wellness', descriptionKey: 'pages.integrations.cards.strava' },
  { key: 'appleHealth', name: 'Apple Health', icon: '❤️', category: 'Wellness', descriptionKey: 'pages.integrations.cards.appleHealth' },
  { key: 'coursera', name: 'Coursera', icon: '🎓', category: 'Learning', descriptionKey: 'pages.integrations.cards.coursera' },
  { key: 'udemy', name: 'Udemy', icon: '📖', category: 'Learning', descriptionKey: 'pages.integrations.cards.udemy' },
]

