# Ranker

<div align="center" style="margin: 1.5rem 0; padding: 0.8rem 1.2rem; border: 1px solid #7fd0ff; border-radius: 999px; background: rgba(127, 208, 255, 0.12); color: #7fd0ff; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">
  zigsim.eu
</div>

> ⚠️ This is a fully vibecoded project.
> 🤖 It was made using GitHub Copilot Free, under the new billing setup, and used up exactly 50% of the available free credits.

Ranker is a simple SvelteKit app for creating a ranking list, sharing it with someone else, and comparing how both people scored the same items.

## Project structure

- Frontend: SvelteKit pages and UI in the src/routes and src/lib folders.
- Backend: server-side API routes under src/routes/api that handle list creation, loading, scoring, and deletion.
- Storage: Supabase is used for persistence through the server-side storage layer.
- Main features: create a list, set creator scores, protect it with a password, share a link, let someone else rank it, and compare the results.

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```
