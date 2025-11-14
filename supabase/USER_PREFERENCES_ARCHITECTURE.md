# User Preferences Architecture

## Overview

User preferences in DOER are stored in the `user_settings` table with a hybrid approach:
- **Profile data** (display_name, avatar_url) → Separate columns
- **User preferences** (theme, accent_color, workday hours, etc.) → JSONB column

## Database Schema

### Table: `user_settings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Foreign key to auth.users |
| `display_name` | text | User's display name (separate column) |
| `avatar_url` | text | User's avatar URL (separate column) |
| `preferences` | jsonb | All user preferences stored as JSON |

### Preferences JSONB Structure

The `preferences` column stores a JSON object with the following structure:

```json
{
  "time_format": "12h",
  "workday_start_hour": 9,
  "workday_end_hour": 17,
  "lunch_start_hour": 12,
  "lunch_end_hour": 13,
  "week_start_day": 0,
  "theme": "dark",
  "accent_color": "orange",
  "auto_reschedule": {
    "enabled": true,
    "reschedule_window_days": 3,
    "priority_spacing": "moderate",
    "buffer_minutes": 15
  },
  "smart_scheduling": {
    "enabled": true,
    "auto_reschedule": true,
    "penalty_reduction": true,
    "notification_threshold": 24
  }
}
```

## Why This Architecture?

### Separate Columns (display_name, avatar_url)
- **Queryable**: Easy to search/filter users by display name
- **Indexable**: Can create indexes for faster lookups
- **Simple**: Direct column access, no JSON parsing needed

### JSONB Column (preferences)
- **Flexible**: Easy to add new preferences without schema changes
- **Efficient**: PostgreSQL JSONB is optimized for JSON storage
- **Grouped**: Related preferences are logically grouped together
- **Extensible**: Can add nested structures (like `auto_reschedule`)

## How Preferences Are Saved

### 1. Settings Page (`/settings`)
- User changes preferences in the UI
- Preferences are saved via `/api/profile` POST endpoint
- The API merges new preferences with existing ones

### 2. API Route (`/api/profile`)
- Fetches current preferences from database
- Merges incoming preferences with existing ones
- Saves to `user_settings.preferences` JSONB column
- Also saves `display_name` and `avatar_url` to separate columns

### 3. Code Location
- **Settings UI**: `src/app/settings/page.tsx`
- **API Route**: `src/app/api/profile/route.ts`
- **Database**: `supabase/migrations/` (various migration files)

## Current Status

### ✅ Properly Saved
- `display_name` → Separate column
- `avatar_url` → Separate column
- `theme` → preferences JSONB (saved when user clicks "Save")
- `accent_color` → preferences JSONB (saved when user clicks "Save")
- `time_format` → preferences JSONB
- `workday_*_hour` → preferences JSONB
- `week_start_day` → preferences JSONB
- `auto_reschedule` → preferences JSONB (nested object)
- `smart_scheduling` → preferences JSONB (nested object)

### Default Values
- Defaults are set in database migrations
- New users get sensible defaults (dark theme, orange accent, etc.)
- Existing users retain their saved preferences

## Migration History

1. **Initial schema**: Created `user_settings` table with basic preferences
2. **Week start day**: Added `week_start_day` to defaults
3. **Auto-reschedule**: Added `auto_reschedule` nested object
4. **Theme & accent color**: Added `theme` and `accent_color` to defaults (2025-11-07)

## Querying Preferences

### Get user preferences
```sql
SELECT preferences FROM user_settings WHERE user_id = '...';
```

### Get specific preference
```sql
SELECT preferences->>'theme' FROM user_settings WHERE user_id = '...';
```

### Update preference
```sql
UPDATE user_settings 
SET preferences = jsonb_set(preferences, '{theme}', '"light"')
WHERE user_id = '...';
```

## Notes

- **Preferences are only saved when user clicks "Save"** - not automatically on every change
- **Theme and accent_color are stored in preferences JSONB** - they're not in the default migration defaults, but they ARE saved when the user saves their settings
- **The JSONB column is flexible** - you can add new preferences without a migration (though adding defaults requires a migration)
- **Display name and avatar are separate columns** - this makes them easier to query and index











