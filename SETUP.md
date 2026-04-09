# AI Team Manager — Setup Guide

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up Supabase
1. Go to [supabase.com](https://supabase.com) and open your project
2. Go to **SQL Editor** and run the migration file: `supabase/migrations/001_initial_schema.sql`
3. Go to **Settings → API** and copy your:
   - Project URL
   - Anon/public key

### 3. Configure environment
Create a `.env` file in the project root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run the app
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) on your phone or browser.

## Supabase Auth Setup
In your Supabase dashboard, go to **Authentication → Providers** and make sure:
- Email provider is enabled
- "Enable email confirmations" is on (or off for testing)
- Magic link is enabled (it's on by default)

## What's Included (Phase 1 — MVP)

- Club & team creation with invite links
- Player registration via invite code
- Magic link authentication (no password needed for players)
- Player availability management (week-by-week)
- Position preferences
- Coach team selection with auto-fill
- Player ratings (1-10 scale)
- Team sheet view
- Round/season management
- Game day roles
- In-app notifications

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS v4
- Supabase (auth, database, real-time)
- React Router DOM
- Lucide React icons
