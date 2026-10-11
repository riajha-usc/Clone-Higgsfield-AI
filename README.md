# higgsfield-clone

A no-login clone of the core AI image/video generation loop: prompt, pick a model, generate, get a file, with an honest local credits ledger. See `CONTEXT.md` for the full product brief.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Dexie (IndexedDB), Zustand.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Images come from Pollinations (`GENERATION_PROVIDER_IMAGE=pollinations`), which is free and needs no key. Set it to `mock` to use bundled samples offline. Videos use `mock` (motion previews). Adding `GEMINI_API_KEY` enables the Nano Banana model. See `.env.example` for every option.
