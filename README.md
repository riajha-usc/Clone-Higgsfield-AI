# higgsfield-clone

A no-login clone of the core AI image/video generation loop: prompt, pick a model, generate, get a file, with an honest local credits ledger. See `CONTEXT.md` for the full product brief.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Dexie (IndexedDB), Zustand.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

The default providers are `mock`, so no API keys are needed.
