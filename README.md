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

## Discogs dump ingestion (vinyl-only)
The app import flow is optimized to avoid per-release Discogs API calls by using a local “catalog index”.

This repo includes a starter ingestion script that parses a Discogs `releases.xml.gz` dump, filters to releases where the dump’s `<formats>` includes a `name="Vinyl"` format, and upserts those releases into MongoDB.

### Required env
- `MONGODB_URI`
- `MONGODB_DB` (optional, default: `discogsdecks`)
- `MONGODB_CATALOG_COLLECTION` (optional, default: `discogs_catalog_vinyl`)

### Optional: archive raw dumps to S3-compatible object storage
If you set these, the script will upload the `.gz` file before parsing:
- `OBJECT_STORE_BUCKET`
- `OBJECT_STORE_REGION` (optional; for Cloudflare R2 you can use `auto`)
- `OBJECT_STORE_ENDPOINT` (optional; required for R2)
- `OBJECT_STORE_ACCESS_KEY_ID`
- `OBJECT_STORE_SECRET_ACCESS_KEY`
- `OBJECT_STORE_PREFIX` (optional, default: `discogs`)

### Run
- Local file: `npm run discogs:ingest:vinyl -- --source ./path/to/releases.xml.gz`
- URL: `npm run discogs:ingest:vinyl -- --source https://example.com/releases.xml.gz`

Options:
- `--uploadRaw=false` to skip object-store upload
- `--dryRun` to parse without writing to MongoDB

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
