# Integration Logos Guide

## How to Add Integration Logos

### Option 1: Using Simple Icons (Recommended for Quick Setup)
1. **Download from Simple Icons** (https://simpleicons.org/):
   - Visit https://simpleicons.org/
   - Search for the integration name (e.g., "Google Calendar", "Slack")
   - Click on the icon
   - Download as SVG
   - Save to `doer/public/integrations/` folder

2. **Use in Component**:
   ```tsx
   import Image from 'next/image'
   <Image 
     src="/integrations/google-calendar.svg" 
     alt="Google Calendar" 
     width={48} 
     height={48}
   />
   ```

### Option 2: Using Icon Libraries
1. **Install react-icons** (if not already installed):
   ```bash
   npm install react-icons
   ```

2. **Use branded icons**:
   ```tsx
   import { SiGooglecalendar, SiSlack, SiAsana } from 'react-icons/si'
   // Then use: <SiGooglecalendar className="w-12 h-12" />
   ```

### Option 3: Custom Logo Files
1. **Download official logos**:
   - Visit each integration's brand guidelines page
   - Download official SVG or PNG logos
   - Ensure they're sized appropriately (preferably SVG)
   - Save to `doer/public/integrations/` folder

2. **Recommended sizes**: 48x48px or 64x64px for icons

### Current Integrations Needed:
- Google Calendar
- Outlook
- Apple Calendar
- Todoist
- Asana
- Trello
- Notion
- Evernote
- Slack
- Microsoft Teams
- Strava
- Apple Health
- Coursera
- Udemy

### Implementation Steps:
1. Create folder: `doer/public/integrations/`
2. Download logos for each integration
3. Update the integrations array in `page.tsx` to use Image components instead of emoji
4. Replace emoji placeholders with actual logo images

### Example Implementation:
```tsx
{
  name: 'Google Calendar',
  icon: '/integrations/google-calendar.svg' // or use react-icons component
}
```

Then in the component:
```tsx
{integration.icon.startsWith('/') ? (
  <Image src={integration.icon} alt={integration.name} width={48} height={48} />
) : (
  <div className="text-2xl">{integration.icon}</div>
)}
```














