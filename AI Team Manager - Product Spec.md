# AI Team Manager — Product Specification

**Version:** 1.0 (Draft)
**Date:** 9 April 2026
**Author:** Will + Claude

---

## 1. Overview

AI Team Manager is a Progressive Web App (PWA) that helps local football clubs organise their team each week. The app handles player registration, availability tracking, position preferences, coach ratings, automated team selection, role rostering, and game-day communication — all from a mobile-friendly interface.

The primary sport is AFL (VAFA league), but the system is designed to be configurable for other football codes (soccer, rugby league, rugby union) by adjusting team size, positions, and rules.

**Why a PWA?** Players open a link on their phone, tap "Add to Home Screen," and it works like a native app — no app store download required. Works on both iPhone and Android.

**Key Decisions:**
- No player photos — keep it lightweight
- Team management only — no match results or stats tracking
- Adults only (18+) — no junior teams or parent/guardian accounts needed
- Multiple coaches and admins per team supported
- Fixtures entered manually (VAFA uses PlayHQ but doesn't publish fixtures in advance reliably; API integration is a future possibility)
- Primary notifications via **push notifications** (PWA Web Push) — email is optional/secondary

---

## 2. User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Club Admin** | Creates and manages the club/team | Full access — manage teams, seasons, coaches, settings |
| **Coach** | Manages team selection and player ratings | Rate players, select teams, assign positions, set rotations, manage roles |
| **Player** | Registered team member | Set availability, position preferences, view team sheets, receive notifications |

A single person can hold multiple roles (e.g., a playing coach). Multiple people can hold the same role (e.g., two coaches, two admins).

---

## 3. Core Features

### 3.1 Club & Team Enrolment

**Club Setup:**
- Club Admin creates a club (name, logo, colours, location)
- Creates one or more teams within the club (e.g., Seniors, Reserves, U18s)
- Configures each team's settings:
  - Sport type (AFL, soccer, rugby league, rugby union)
  - Number of on-field players (default 18 for AFL)
  - Number of bench/interchange players (default 6 for AFL)
  - Total match-day squad size (default 24 for AFL)
  - Emergency player slots (optional)
  - Available positions (customisable per sport — see Section 6)

**Player Registration:**
- Club Admin generates an invite link or code for each team
- Players sign up via the link (name, email, phone, jersey number)
- Admin approves or auto-approves new registrations
- Players can be members of multiple teams within the same club

### 3.2 Player Availability & Preferences

**Availability:**
- Players mark themselves as Available, Unavailable, or Maybe for each round
- Can set availability week-by-week or in bulk for the full season
- Availability deadline configurable by coach (e.g., "availability closes Wednesday 6pm")
- Dashboard shows the coach a live view of who's in/out/maybe
- Players who haven't responded get a reminder notification

**Position Preferences:**
- Each player selects their preferred positions (ranked 1st, 2nd, 3rd choice)
- Positions are configurable per sport/team (see Section 6)
- Players can update preferences at any time

### 3.3 Coach Player Ratings

**Rating System:**
- Coaches rate each player on a 1–10 scale across key attributes:
  - **Overall ability** — general rating
  - **Position-specific ratings** — how well they play each position
  - **Fitness** — current fitness level
  - **Form** — recent form (last 2–4 weeks)
- Ratings are private (only visible to coaches, not players)
- Ratings can be updated weekly after each game
- Historical ratings tracked over the season

**How ratings are used:**
- Feed into the AI team selection algorithm
- Help coaches decide who plays where and who sits on the bench
- Inform rotation decisions when the squad is larger than the match-day team

### 3.4 AI-Assisted Team Selection

This is the core "AI" feature. Based on available players, ratings, preferences, and recent history, the app suggests a team sheet.

**Inputs:**
- Which players are available this week
- Player ratings (overall + position-specific)
- Player position preferences
- Recent game history (who played last week, who was benched, who missed out)
- Any coach overrides or locked selections

**AI Logic:**
1. Start with available players only
2. For each position, rank candidates by: position-specific rating × form × preference weighting
3. Assign best-fit players to positions, resolving conflicts (two players wanting the same spot) by rating
4. Fill bench spots with remaining highest-rated players
5. If more available players than match-day spots → create a roster/rotation suggestion (e.g., "Player X sits out this week but is first priority next week")
6. Flag any positions that are thin (only one available player) or unfilled

**Coach Control:**
- Coach can lock specific players into positions before running the AI
- Coach can manually override any AI suggestion
- Coach can re-run the suggestion after making changes
- Final team sheet is always approved by the coach before being sent

### 3.5 Rotation & Interchange Planning

**For when the squad exceeds match-day numbers:**
- The app tracks who has been benched or missed out in recent weeks
- Suggests a fair rotation so no player consistently misses out (unless rated significantly lower)
- Coach can set a "minimum games" target per player per season

**Match-Day Interchange (AFL-specific):**
- Coach can set planned rotations during the game (e.g., "Player A starts forward, rotates to bench at quarter time")
- Rough timing suggestions for interchange rotations
- This is a planning tool, not live — it's set before the game

### 3.6 Roles & Responsibilities Rostering

Beyond playing positions, teams need people to fill game-day roles each week.

**Default Roles (customisable):**
- Goal Umpire
- Runner / Water Carrier
- Boundary Umpire
- Timekeeper
- First Aid / Trainer
- Team Manager (game day admin)
- Scorer

**How it works:**
- Coach/Admin creates the roles needed each week
- Can assign specific people (players or non-players) to roles
- Can set up a rotation roster (e.g., "parents rotate goal umpire duty")
- Ability to add custom roles as needed
- Role assignments appear on the game-day team sheet

### 3.7 Game-Day Team Sheet & Communication

**Team Sheet:**
- Once the coach finalises the team, a game-day team sheet is generated
- Includes: opposition, date/time, venue, on-field positions, bench, emergencies, role assignments, any rotation notes
- Clean, easy-to-read format optimised for mobile

**Notifications (Push-First):**
- Primary channel: **PWA Web Push Notifications** — pop up on the player's phone like a native app
- Players are prompted to enable push notifications when they first open the app
- All players receive a push notification when the team is announced
- Players who missed selection are notified separately with a softer message (customisable by coach)
- Reminder push notification sent morning of the game with venue and time
- Email is available as an **optional secondary channel** — players can opt in if they prefer email as well
- In-app notification centre stores all past notifications for reference

### 3.8 Season & Round Management

- Admin sets up the season (start date, number of rounds, bye weeks)
- Fixtures entered manually (opposition + venue per round)
- Each round tracks: team selected, games played per player
- Season-long views: games played per player, average rating trends
- Future: potential PlayHQ API integration for automatic fixture import

---

## 4. Screen Map

### Players See:

1. **Home / Dashboard** — Next game info, their selection status, quick availability toggle
2. **My Availability** — Calendar view to set availability for upcoming rounds
3. **My Profile** — Position preferences, personal details, jersey number
4. **Team Sheet** — View the current round's team sheet
5. **Season Schedule** — Full fixture list with results
6. **Notifications** — In-app notification history

### Coaches See (everything players see, plus):

7. **Team Selection** — The main workspace: see available players, run AI suggestion, drag-and-drop to assign positions, lock/override, finalise and send
8. **Player Ratings** — Rate players, view rating history, compare players
9. **Squad Overview** — Full roster with availability status, games played, ratings summary
10. **Rotation Tracker** — Who's been in/out, fairness metrics, suggested rotation
11. **Roles Manager** — Create roles, assign people, set up rotation rosters
12. **Round Management** — Set up each round's details (opposition, venue, time)

### Admin See (everything coaches see, plus):

13. **Club Settings** — Club details, branding, team configuration
14. **Team Settings** — Sport type, positions, squad size rules
15. **Member Management** — Approve/remove players, assign coach role, generate invite links
16. **Season Setup** — Create seasons, import fixtures

---

## 5. Data Model (Supabase / PostgreSQL)

### Core Tables

```
clubs
├── id (uuid, PK)
├── name (text)
├── logo_url (text, nullable)
├── primary_colour (text)
├── secondary_colour (text)
├── location (text)
├── created_at (timestamp)
└── created_by (uuid, FK → auth.users)

teams
├── id (uuid, PK)
├── club_id (uuid, FK → clubs)
├── name (text) — e.g., "Seniors", "Reserves"
├── sport_type (enum: afl, soccer, rugby_league, rugby_union)
├── on_field_count (int) — e.g., 18
├── bench_count (int) — e.g., 6
├── emergency_count (int) — e.g., 2
├── created_at (timestamp)
└── settings (jsonb) — flexible config

positions
├── id (uuid, PK)
├── team_id (uuid, FK → teams)
├── name (text) — e.g., "Full Back", "Centre Half Forward"
├── abbreviation (text) — e.g., "FB", "CHF"
├── category (text) — e.g., "Defence", "Midfield", "Forward", "Ruck"
└── sort_order (int)

seasons
├── id (uuid, PK)
├── team_id (uuid, FK → teams)
├── name (text) — e.g., "2026 Season"
├── start_date (date)
├── end_date (date)
└── is_active (boolean)

rounds
├── id (uuid, PK)
├── season_id (uuid, FK → seasons)
├── round_number (int)
├── opposition (text)
├── venue (text)
├── date_time (timestamp)
├── is_bye (boolean)
├── availability_deadline (timestamp)
└── status (enum: upcoming, team_selected, completed)

members
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── team_id (uuid, FK → teams)
├── role (enum: admin, coach, player)
├── jersey_number (text, nullable)
├── status (enum: active, inactive)
└── joined_at (timestamp)

player_availability
├── id (uuid, PK)
├── member_id (uuid, FK → members)
├── round_id (uuid, FK → rounds)
├── status (enum: available, unavailable, maybe)
└── updated_at (timestamp)

position_preferences
├── id (uuid, PK)
├── member_id (uuid, FK → members)
├── position_id (uuid, FK → positions)
└── preference_rank (int) — 1 = first choice

player_ratings
├── id (uuid, PK)
├── member_id (uuid, FK → members)
├── rated_by (uuid, FK → members) — the coach
├── round_id (uuid, FK → rounds, nullable) — optional: per-round rating
├── overall (int, 1-10)
├── fitness (int, 1-10)
├── form (int, 1-10)
└── updated_at (timestamp)

position_ratings
├── id (uuid, PK)
├── player_rating_id (uuid, FK → player_ratings)
├── position_id (uuid, FK → positions)
└── rating (int, 1-10)

team_selections
├── id (uuid, PK)
├── round_id (uuid, FK → rounds)
├── status (enum: draft, finalised, sent)
├── created_by (uuid, FK → members)
├── finalised_at (timestamp, nullable)
└── notes (text, nullable)

selection_players
├── id (uuid, PK)
├── team_selection_id (uuid, FK → team_selections)
├── member_id (uuid, FK → members)
├── position_id (uuid, FK → positions, nullable)
├── selection_type (enum: on_field, bench, emergency, omitted)
├── is_locked (boolean) — coach locked this pick
└── sort_order (int)

rotation_plans
├── id (uuid, PK)
├── team_selection_id (uuid, FK → team_selections)
├── member_id (uuid, FK → members)
├── quarter (int) — 1, 2, 3, 4
├── position_id (uuid, FK → positions, nullable)
└── notes (text, nullable)

game_day_roles
├── id (uuid, PK)
├── team_id (uuid, FK → teams)
├── name (text) — e.g., "Goal Umpire"
├── description (text, nullable)
└── is_active (boolean)

role_assignments
├── id (uuid, PK)
├── round_id (uuid, FK → rounds)
├── role_id (uuid, FK → game_day_roles)
├── assigned_to (text) — name (might not be a registered user)
├── member_id (uuid, FK → members, nullable) — if assigned to a player
└── notes (text, nullable)

notifications
├── id (uuid, PK)
├── user_id (uuid, FK → auth.users)
├── type (enum: team_announced, availability_reminder, role_assigned, game_reminder)
├── title (text)
├── body (text)
├── read (boolean)
├── created_at (timestamp)
└── metadata (jsonb)
```

---

## 6. Position Configurations by Sport

### AFL (Default)
**Defence:** Full Back (FB), Back Pocket ×2 (BP), Centre Half Back (CHB), Half Back Flank ×2 (HBF)
**Midfield:** Centre (C), Wing ×2 (W), Ruck (R), Ruck Rover (RR), Rover (ROV)
**Forward:** Full Forward (FF), Forward Pocket ×2 (FP), Centre Half Forward (CHF), Half Forward Flank ×2 (HFF)
**Interchange:** Bench ×4 (or configurable)

### Soccer
**Defence:** Goalkeeper (GK), Centre Back ×2 (CB), Left Back (LB), Right Back (RB)
**Midfield:** Central Midfield ×2 (CM), Left Mid (LM), Right Mid (RM)
**Forward:** Striker (ST), Centre Forward (CF)

### Rugby League
**Backs:** Fullback (1), Wing ×2 (2,5), Centre ×2 (3,4), Five-eighth (6), Halfback (7)
**Forwards:** Prop ×2 (8,10), Hooker (9), Second Row ×2 (11,12), Lock (13)

### Rugby Union
Configurable 15-player setup with front row, second row, back row, halfbacks, centres, back three.

---

## 7. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + TypeScript + Vite | Fast, modern, well-supported PWA tooling |
| **UI Framework** | Tailwind CSS + shadcn/ui | Clean mobile-first design, accessible components |
| **PWA** | Vite PWA Plugin | Service worker, offline support, installable |
| **Backend** | Supabase | Auth, PostgreSQL database, real-time subscriptions, edge functions |
| **Auth** | Supabase Auth | Email/password + magic link (easy for players) |
| **Push Notifications** | Web Push API + Supabase Edge Functions | Primary notification channel — works like native app alerts |
| **Email (optional)** | Supabase Edge Functions + Resend (or similar) | Secondary channel for players who opt in |
| **AI Logic** | Supabase Edge Functions | Team selection algorithm runs server-side |
| **Hosting** | Vercel or Netlify | Free tier, automatic deployments, custom domain support |

---

## 8. AI Team Selection Algorithm (Detail)

The "AI" in AI Team Manager is a weighted optimisation algorithm, not a machine learning model. It's deterministic and explainable — coaches can understand why each suggestion was made.

### Step-by-step:

1. **Filter** — Only consider players marked "available" (optionally include "maybe" as flag)

2. **Score each player for each position:**
   ```
   score = (position_rating × 0.4) + (overall_rating × 0.2) + (form × 0.2) + (fitness × 0.1) + (preference_bonus × 0.1)
   ```
   - `preference_bonus`: 10 if 1st preference, 7 if 2nd, 4 if 3rd, 0 otherwise
   - All ratings normalised to 0–10 scale

3. **Assign positions** using a greedy best-fit approach:
   - Sort all (player, position) pairs by score descending
   - Assign highest-scoring pair first
   - Once a player is assigned, remove them from remaining pairs
   - Once a position is filled, remove it from remaining pairs

4. **Fill bench** — Remaining available players sorted by overall rating

5. **Handle excess players:**
   - Check rotation history: who sat out recently?
   - Prioritise players who've missed more games
   - Suggest omissions with fairness reasoning

6. **Generate explanations** — For each selection: "Player X in CHF because: rated 8/10 for this position, in good form (8/10), it's their 1st preference"

### Coach Overrides:
- Locked players are assigned first, before the algorithm runs
- Coach can re-run after manual changes
- Override reasons are tracked for transparency

---

## 9. Notification Flow

All notifications use **PWA Web Push** as the primary channel. Email is opt-in secondary.

### Team Announcement:
1. Coach finalises team → taps "Send Team Sheet"
2. Push notification sent to all squad members: "Round X team is out — tap to view"
3. In-app notification centre updated with full team sheet
4. Players who missed selection get a softer push: "Round X team announced. [Coach's custom message]"
5. If player has opted into email → email also sent with formatted team sheet

### Availability Reminders:
- Configurable reminder (e.g., 48 hours before deadline)
- Push notification only sent to players who haven't responded yet
- "Reminder: Please set your availability for Round X by [deadline]"

### Game Day Reminder:
- Morning of the game (configurable time)
- Push notification sent to selected players + role holders
- Includes: venue, time, their position/role, any notes from the coach

### Push Notification Setup:
- Players prompted to enable notifications on first login
- Uses the Web Push API with VAPID keys (free, no third-party service needed)
- Subscription tokens stored in Supabase
- Works on Android (Chrome, Edge, Firefox) and iOS (Safari 16.4+)

---

## 10. Authentication & Access

- **Sign up:** Email + password, or magic link (passwordless — recommended for players)
- **Join a team:** Via invite link/code from Admin
- **Row-Level Security (RLS):** Supabase RLS policies ensure players only see their own data, coaches see their team's data, admins see everything in their club
- **No public data** — everything requires authentication

---

## 11. Build Phases

### Phase 1 — Foundation (MVP)
- Club & team setup
- Player registration & invite system
- Supabase auth (magic link)
- Position configuration
- Player availability (week-by-week)
- Basic team selection (manual, no AI yet)
- Team sheet view
- In-app notifications

### Phase 2 — Intelligence
- Player ratings system
- Position preferences
- AI team selection algorithm
- Rotation tracking & fairness
- Coach overrides & locked selections

### Phase 3 — Communication
- PWA push notifications (team sheet, reminders, game day)
- In-app notification centre
- Customisable coach messages
- Optional email opt-in for players who want it

### Phase 4 — Roles & Polish
- Game-day roles & responsibilities
- Role rostering / rotation
- Season-long statistics & views
- Interchange / rotation planner
- Import fixture from CSV

### Phase 5 — Future Ideas
- Live game-day interchange tracker
- Player self-rating / feedback
- Multi-sport presets (one-tap setup)
- PlayHQ API integration for automatic VAFA fixture import
- Match results and basic stats tracking
- Junior team support (parent/guardian accounts)

---

## 12. Resolved Questions

1. **League integration** — VAFA uses PlayHQ. Fixtures aren't published reliably in advance, so manual entry for now. PlayHQ API integration is a future possibility.
2. **Player photos** — No. Keeping it lightweight.
3. **Results & stats** — No. Focused purely on team management.
4. **Junior teams** — No. 18+ adults only.
5. **Multiple coaches** — Yes. Multiple coaches and admins per team supported.
6. **Notifications** — Push notifications (PWA Web Push) are the primary channel. Email is optional/secondary. Costs are minimal — Web Push is free, email only needed for opt-in users.

---

*This spec is a living document. Let's review it together and refine before we start building.*
