# CONTEXT.md

Project context for the Higgsfield clone. Read this file at the start of every task. It does not change during the build.

## What Higgsfield is

Higgsfield.ai is a web app for generating AI images and short videos. The core loop is: type a prompt, optionally attach a reference image, pick an AI model from a dropdown, click Generate, wait, get a file. Every generation costs credits. Credits come from a subscription (Starter 270 per month, Plus 1,200, Ultra 3,000; free accounts get 10 one time). Generations live inside Projects. A project has folders of assets, a brief, project-scoped Elements (Characters, Locations, Props that can be @-mentioned in prompts), and tools (Canvas, Chat, AI Director). There is a Community feed and a public profile. Higgsfield fronts around 30 third-party models (Seedance, Kling, Veo, Sora, Nano Banana, Wan) plus a few of its own (Soul for images, Cinema Studio and DoP for video, Genjutsu for motion transfer).

## Observed behaviour that matters for the clone

- The generate bar changes shape per mode and per model. Image mode shows a model chip, aspect ratio, quality, batch count, and a style toggle. Video mode with Seedance shows Start Frame and End Frame slots. Video mode with Cinema Studio shows five extra chips (References, Film setup, Camera, Color palette, Lighting) and a thumbnail strip. Same action, three layouts.
- Credit cost is shown on the Generate button (for example "0.125" for a Soul image, "5" for a Seedance 480p 8 second video, "60" for Cinema Studio 1080p). The user's balance is not shown anywhere on the generate screen; it is hidden in the account menu.
- A brand new free user has 10 credits and lands on a screen whose default Generate costs 60. Nothing says it is unaffordable. Clicking Generate with an empty prompt silently creates a new empty project.
- Image prompts are rewritten by a hidden prompt enhancer into a long paragraph. Video prompts are not. The user is never told.
- Each result opens a detail drawer: author, prompt with Copy, model, quality, size, created time, "Filed in" project and folder, and actions Turn to video, Recreate, Reference, Download, favourite, share. Video results also show Edit, Extend, Trim over the player.
- Onboarding is a seven step wizard (goal, experience level, products, features, attribution, frustration, username and terms) followed by three interstitials (a feature popup, a full screen upsell with a countdown, and a modal on top of it). The wizard changes nothing in the interface afterwards.
- Pricing defaults to Annual. The headline says "55% off". The Plus card says 40% off. Checkout says 41% off and "$420 due today". Monthly prices are only visible after flipping the toggle. Ultra monthly is $99 "renews at $129".

## What we are building

A working clone of the core loop with a project model, honest credits, and a single consistent generate bar. Repo name: higgsfield-clone. It must run entirely on free tiers and must cost nothing to build or demo.

Two deliberate product decisions that differ from the original:

1. No login and no account. The visitor lands directly in the studio with 10 credits and a seeded demo project. Identity is the browser. All state (credits ledger, projects, generations, favourites, plan) is stored locally in IndexedDB behind a repository interface, so a server database can be added later without touching the UI. Opening the app in a private window produces a fresh first-run experience, which is what a reviewer should see.
2. No server database. There is no Supabase, no Postgres, no auth. The only server code is a handful of Next.js route handlers that proxy generation providers so keys never reach the browser.

Stack: Next.js 14 or 15 (App Router, TypeScript), Tailwind CSS, shadcn/ui components, Dexie.js for IndexedDB, Zustand or React context for in-memory state, deployed on Vercel free tier.

## Generation providers, behind one interface

- Image, default: Pollinations image endpoint. GET https://image.pollinations.ai/prompt/{urlencoded prompt}?width=W&height=H&seed=S&model=flux&nologo=true. No key for basic use, rate limited to roughly one request every five seconds per IP. If the endpoint demands a key, register a free key at enter.pollinations.ai and send it as a header from the server proxy. Output URLs are deterministic for a given prompt and seed, so the URL itself is the stored artifact.
- Image, upgrade if time: Google Gemini API, model gemini-2.5-flash-image, free tier from AI Studio with no card. Set GEMINI_API_KEY on the server. Optional.
- Image and video, if the user supplies FAL_KEY: fal.ai (flux/schnell for images, a cheap image to video model for video). Optional. Do not block on it.
- Video, default: a "motion preview" provider that produces no AI video. It stores the start frame plus a camera preset and the player renders the motion with CSS keyframes (push in, pull out, pan left, pan right, orbit, handheld). It costs credits like a real generation so the ledger flow is exercised. The UI labels it clearly as "Motion preview (no AI video, free)".

Provider interface (TypeScript): submit(input) returns a jobId; poll(jobId) returns pending, running, succeeded with outputUrl, or failed with reason. One implementation per provider, chosen by environment variables GENERATION_PROVIDER_IMAGE and GENERATION_PROVIDER_VIDEO. A mock provider that returns bundled sample files after a random 3 to 8 second delay must exist and is the default in development.

## Data model (local, IndexedDB via Dexie)

- settings: one row. credits are derived, not stored. Holds plan (free, starter, plus, ultra), term (monthly, annual), createdAt, enhancePromptDefault (false).
- ledger: id, delta (positive for grants and refunds, negative for debits), reason (signup_grant, generation_debit, generation_refund, upgrade_grant), generationId (nullable), createdAt. Balance is the sum of delta.
- projects: id, name, createdAt, updatedAt.
- generations: id, projectId, type (image or video), status (queued, running, succeeded, failed), prompt, enhancedPrompt (nullable), modelId, params (aspect, quality, duration, seed, presetId, startFrameGenerationId), cost, provider, providerJobId, outputUrl, thumbnailUrl, error (nullable), parentGenerationId (nullable), favourite (boolean), createdAt, completedAt.
- models (static JSON, not in the database): id (soul-2, flux-schnell, nano-banana, motion-preview, seedance-1-5), displayName, type, provider, costPerGeneration, defaultParams, enabled (computed from which env keys the server reports), sortOrder.
- presets (static JSON): id, displayName, description, cssKeyframesName, sortOrder.

Repository interface: one module exporting getBalance, addLedgerEntry, listProjects, createProject, listGenerations(projectId or all), createGeneration, updateGeneration, getGeneration, getLineage(id). All UI code calls this module and nothing else.

## Design language

Dark UI. Background near black (#0B0B0C), panels #141416, borders #26262A, text #F2F2F2, muted text #9A9AA3. Accent is a yellow green (#D8FF3D) used only for the primary action and the credit balance. Rounded corners 12px on cards, pill chips 999px. Font Inter. Do not copy Higgsfield's logo, name, or marketing copy. The screenshots are for layout and flow reference only.

## Non-goals

No login, no server database, no community feed, no comments, no blog, no achievements, no MCP, no CLI, no team workspaces, no real payments, no onboarding wizard, no interstitials.
