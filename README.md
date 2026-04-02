# DiscogsDecks (local dev)

This repo is a full-stack app:
- React + Vite frontend (served via Vite middleware in development)
- Express + TypeScript backend
- Postgres via Drizzle ORM (configured through `DATABASE_URL`)

## Prereqs
- Node.js 20+ (recommended)
- A Postgres database (Neon or local)

## Setup
1. Install dependencies:
   - `npm install`
2. Create a local env file:
   - Copy `.env.example` to `.env` and fill in values.

### Discogs keys
Create an app at https://www.discogs.com/settings/developers and set:
- `DISCOGS_CONSUMER_KEY`
- `DISCOGS_CONSUMER_SECRET`

## Database
This project expects `DATABASE_URL` to point at a Postgres instance.

If you’re using Neon, use the connection string Neon provides.

Then push schema:
- `npm run db:push`

## Run locally
- `npm run dev`

The app serves API + UI from the same server:
- http://localhost:5000

## Build + run production mode
- `npm run build`
- `npm run start`

## GitHub hygiene
- Secrets belong in `.env` (ignored by git).
- Replit agent state under `.local/` is ignored.
