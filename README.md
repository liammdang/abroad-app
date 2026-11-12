# Abroad — Study Abroad Sidekick

*Your life abroad, in one place.* A web app for exchange students: classes, paperwork, local spots and community in the host city.

Built with **Vite + React + TypeScript + Tailwind CSS**, the same stack Lovable uses, so you can import this repo straight into Lovable.

## Features

- **City-adapted onboarding**: pick Berlin, Madrid or Lisbon, your university, stay dates and interests. Checklists, spots, events and inbox samples change with the city.
- **Home dashboard**: today's schedule, arrival progress, explore spotlight, community highlights, and the AI Companion.
- **Unified calendar**: classes, exams, assignments, admin, travel and social in one month or list view, with category filters. Trips you join and meetups you RSVP to show up here automatically. You can **import a real `.ics` timetable file**.
- **Life Admin**: 4 phased checklists (Pre-Departure, First 14 Days, First Month, Departure). Each item opens to show required documents, an insider tip, a downloadable PDF checklist, a Google Maps shortcut, and "Needs first" dependencies.
- **Explore & Community**: local spots with category filters and map links, meetups with RSVP, **Host a meetup**, and a trip ideas board with Join / Interested and **Post a trip**.
- **Settings & Integrations**: toggles for Google Calendar, Google Maps and Smart Email, a smart inbox preview, profile, and a demo reset.

### Two modes

- **Demo mode** (not signed in, or no backend connected): sample data for the chosen city, saved in the browser. Good for presentations.
- **Live mode** (signed in with Google): everything is real. The Supabase backend stores your profile, Life Admin progress and calendar imports. Google Calendar sync is two-way (it reads your calendar and writes to an "Abroad" calendar). Smart Email reads your real Gmail. The community board is shared and updates in realtime. iCal feed links are fetched through an edge function. The **AI Companion** is a real chat with Claude (Opus 5.5), aware of your city, checklist and calendar, with history saved per user.

**To turn on live mode, follow [SETUP.md](SETUP.md)** (Vietnamese, step by step).

Other real features in both modes:
- Life Admin checklists download as printable PDFs.
- Spots and meetups that match your interests come first, marked "For you".
- Your arrival and departure dates go on the calendar, appear on the home screen ("Day 12 of 151"), and pick the Life Admin phase.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:8080.

## Project structure

```
src/
  data/        city content (berlin.ts, madrid.ts, lisbon.ts) + shared types
  state/       AppState.tsx: all app state (demo: localStorage, live: Supabase + Google)
  pages/       Home, Calendar, LifeAdmin, Explore, Settings, Onboarding, Assistant (AI chat)
  components/  Layout (sidebar + mobile tab bar), small UI kit
  lib/         supabase client, Google Calendar/Gmail API, AI chat, .ics parser, PDF, dates
supabase/
  SETUP_DATABASE.sql  all migrations in one file (paste into the SQL Editor)
  migrations/  database schema + Row Level Security
  functions/   edge functions: google-token, ical-proxy, ai-chat (single files)
  seed.sql     optional starter meetups/trips
```

- **Change the demo "today"**: `src/lib/date.ts` (`DEMO_TODAY`, or set `USE_REAL_TODAY = true`).
- **Add a city**: copy `src/data/berlin.ts`, then register it in `src/data/cities.ts` and in the `CityId` type.
- **Theme colours and fonts**: `tailwind.config.ts` (primary indigo `#2B2F7E`, warm canvas `#F8F7F4`, Plus Jakarta Sans + Inter).

## Import into Lovable

1. Push this folder to a new GitHub repository.
2. In Lovable, try connecting GitHub on a new project and selecting this repo (Lovable's docs say only new repos are supported, so this may not work). If it doesn't, deploy the repo to Vercel instead (`vercel.json` is included).
3. Follow [SETUP.md](SETUP.md) to connect Supabase, Google and the AI key for live mode.

## Lovable notes

- The Supabase client reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`). When you connect Supabase in Lovable, make sure these are set.
- Lovable deploys `supabase/functions/*` automatically. Add the `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `ANTHROPIC_API_KEY` secrets in Supabase.
