/**
 * Tool extraction utilities for parsing and normalizing tool/software names from text
 */

// Common tool name variations and their normalized forms
const TOOL_NORMALIZATIONS: Record<string, string> = {
  // Presentation tools
  'ppt': 'PowerPoint',
  'powerpoint': 'PowerPoint',
  'ms powerpoint': 'PowerPoint',
  'microsoft powerpoint': 'PowerPoint',
  'google slides': 'Google Slides',
  'googleslides': 'Google Slides',
  'gs': 'Google Slides',
  'keynote': 'Keynote',
  'apple keynote': 'Keynote',
  'canva': 'Canva',
  'prezi': 'Prezi',
  
  // Calendar tools
  'google calendar': 'Google Calendar',
  'googlecalendar': 'Google Calendar',
  'gcal': 'Google Calendar',
  'outlook calendar': 'Outlook Calendar',
  'outlook': 'Outlook Calendar',
  'apple calendar': 'Apple Calendar',
  'ical': 'Apple Calendar',
  'icalendar': 'Apple Calendar',
  
  // Project management tools
  'doer': 'DOER',
  'asana': 'Asana',
  'trello': 'Trello',
  'notion': 'Notion',
  'todoist': 'Todoist',
  'slack': 'Slack',
  'jira': 'Jira',
  'monday.com': 'Monday',
  'monday': 'Monday',
  
  // Design tools
  'figma': 'Figma',
  'adobe xd': 'Adobe XD',
  'xd': 'Adobe XD',
  'sketch': 'Sketch',
  'photoshop': 'Photoshop',
  'ps': 'Photoshop',
  'illustrator': 'Illustrator',
  'ai': 'Illustrator',
  
  // Development tools
  'vscode': 'VS Code',
  'visual studio code': 'VS Code',
  'github': 'GitHub',
  'git': 'Git',
  'vsc': 'VS Code',
  
  // Writing tools
  'word': 'Microsoft Word',
  'msword': 'Microsoft Word',
  'microsoft word': 'Microsoft Word',
  'google docs': 'Google Docs',
  'googledocs': 'Google Docs',
  'pages': 'Pages',
  'apple pages': 'Pages',
  
  // Spreadsheet tools
  'excel': 'Microsoft Excel',
  'msexcel': 'Microsoft Excel',
  'microsoft excel': 'Microsoft Excel',
  'google sheets': 'Google Sheets',
  'googlesheets': 'Google Sheets',
  'numbers': 'Numbers',
  'apple numbers': 'Numbers',
}

// Tool categories for better context
const TOOL_CATEGORIES: Record<string, string[]> = {
  presentation: ['PowerPoint', 'Google Slides', 'Keynote', 'Canva', 'Prezi'],
  calendar: ['Google Calendar', 'Outlook Calendar', 'Apple Calendar', 'DOER'],
  'project-management': ['DOER', 'Asana', 'Trello', 'Notion', 'Todoist', 'Slack', 'Jira', 'Monday'],
  design: ['Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator', 'Canva'],
  development: ['VS Code', 'GitHub', 'Git'],
  writing: ['Microsoft Word', 'Google Docs', 'Pages'],
  spreadsheet: ['Microsoft Excel', 'Google Sheets', 'Numbers'],
}

/**
 * Normalize a tool name to its canonical form
 */
export function normalizeToolName(tool: string): string {
  const normalized = tool.trim()
  const lower = normalized.toLowerCase()
  
  // Check direct mapping first
  if (TOOL_NORMALIZATIONS[lower]) {
    return TOOL_NORMALIZATIONS[lower]
  }
  
  // Check if it's already a normalized form (case-insensitive)
  const normalizedValues = Object.values(TOOL_NORMALIZATIONS)
  const match = normalizedValues.find(v => v.toLowerCase() === lower)
  if (match) {
    return match
  }
  
  // Return original with proper capitalization if not found
  return normalized
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Identify the category of a tool
 */
export function identifyToolCategory(tool: string): string | null {
  const normalized = normalizeToolName(tool)
  
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    if (tools.includes(normalized)) {
      return category
    }
  }
  
  return null
}

/**
 * Extract tool/software names from free-form text
 * Handles patterns like:
 * - "Google Slides, DOER, and Google Calendar"
 * - "Other: PowerPoint and Canva"
 * - "I'll use VS Code and GitHub"
 */
export function extractToolsFromText(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return []
  }
  
  const tools: string[] = []
  const lowerText = text.toLowerCase()
  
  // Remove common prefixes like "Other:", "I'll use", "Tools:", etc.
  let cleanedText = text
    .replace(/^(other|tools?|software|applications?|apps?):\s*/i, '')
    .replace(/^(i'?ll\s+use|i'?m\s+using|using|with)\s+/i, '')
    .trim()
  
  // Split by common separators: commas, "and", "&", "or", semicolons
  const separators = /[,;&]|\s+and\s+|\s+or\s+/i
  const parts = cleanedText.split(separators).map(p => p.trim()).filter(p => p.length > 0)
  
  for (const part of parts) {
    // Skip common filler words
    if (/^(the|a|an|will|to|for)$/i.test(part)) {
      continue
    }
    
    // Normalize and add
    const normalized = normalizeToolName(part)
    if (normalized.length > 1 && !tools.includes(normalized)) {
      tools.push(normalized)
    }
  }
  
  // If no tools found with separators, try to find tool names in the original text
  if (tools.length === 0) {
    // Look for known tool names (case-insensitive)
    for (const [key, value] of Object.entries(TOOL_NORMALIZATIONS)) {
      const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(text) && !tools.includes(value)) {
        tools.push(value)
      }
    }
    
    // Also check normalized values directly
    for (const normalizedValue of Object.values(TOOL_NORMALIZATIONS)) {
      const regex = new RegExp(`\\b${normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      if (regex.test(text) && !tools.includes(normalizedValue)) {
        tools.push(normalizedValue)
      }
    }
  }
  
  return tools
}

/**
 * Extract tools from clarifications object
 * Searches through all string values in the clarifications
 */
export function extractToolsFromClarifications(
  clarifications?: Record<string, any> | string[]
): string[] {
  if (!clarifications) {
    return []
  }
  
  const allTools: string[] = []
  
  if (Array.isArray(clarifications)) {
    // If clarifications is an array of strings, extract from each
    for (const item of clarifications) {
      if (typeof item === 'string') {
        const tools = extractToolsFromText(item)
        for (const tool of tools) {
          if (!allTools.includes(tool)) {
            allTools.push(tool)
          }
        }
      }
    }
  } else if (typeof clarifications === 'object') {
    // If clarifications is an object, extract from all string values and string arrays
    for (const key in clarifications) {
      const value = clarifications[key]
      if (typeof value === 'string') {
        const tools = extractToolsFromText(value)
        for (const tool of tools) {
          if (!allTools.includes(tool)) {
            allTools.push(tool)
          }
        }
      } else if (Array.isArray(value)) {
        // Handle arrays of strings (multi-select answers)
        // Join array items and extract tools, or extract from each item individually
        const combinedText = value.filter(v => typeof v === 'string').join(', ')
        const tools = extractToolsFromText(combinedText)
        for (const tool of tools) {
          if (!allTools.includes(tool)) {
            allTools.push(tool)
          }
        }
      }
    }
  }
  
  return allTools
}

/**
 * Format tools for inclusion in AI prompts
 * Returns a formatted string that can be inserted into prompts
 */
export function formatToolsForPrompt(tools: string[]): string {
  if (tools.length === 0) {
    return ''
  }
  
  if (tools.length === 1) {
    return `The user has specified they will use: ${tools[0]}`
  }
  
  if (tools.length === 2) {
    return `The user has specified they will use: ${tools[0]} and ${tools[1]}`
  }
  
  const lastTool = tools[tools.length - 1]
  const otherTools = tools.slice(0, -1).join(', ')
  return `The user has specified they will use: ${otherTools}, and ${lastTool}`
}

/**
 * Group tools by category for better organization
 */
export function groupToolsByCategory(tools: string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {}
  
  for (const tool of tools) {
    const category = identifyToolCategory(tool) || 'other'
    if (!grouped[category]) {
      grouped[category] = []
    }
    if (!grouped[category].includes(tool)) {
      grouped[category].push(tool)
    }
  }
  
  return grouped
}

