# higgsfield-clone

Afterglow is a working clone of the core loop of an AI image and video generator: type a prompt, pick a model, generate, get a file. Generations live in projects, every one is paid for from a visible credits ledger, and each result opens into a detail drawer that shows the prompt, what the model actually received, its cost and its lineage. Images come from Pollinations (or Gemini with a key). Video is a motion preview by default: the start frame animated with a named camera move, labelled as such. Seedance 1.5 Pro through fal.ai is available when a key is set. There is no login and no server database; everything lives in the visitor's browser, and it runs entirely on free tiers.

**Production:** https://clone-higgsfield-ai-three.vercel.app

Open it in a private window to see the first-run state: the Demo project, 10 credits, three sample generations.

Stack: Next.js 15 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui, Dexie (IndexedDB), Zustand. Deployed on Vercel's free tier.

## Run locally

Needs Node 20 or later.

```bash
git clone https://github.com/riajha-usc/Clone-Higgsfield-AI.git
cd Clone-Higgsfield-AI
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

With the defaults in `.env.example`, images come from Pollinations and videos are motion previews, so no keys are needed. To work offline, set both provider variables to `mock` (see below). A production build runs with `npm run build && npm start`.

## Environment variables

All server-side. Keys never reach the browser; `/api/capabilities` only reports whether each one is set.

| Variable | Required | What it does |
|---|---|---|
| `GENERATION_PROVIDER_IMAGE` | Yes | `mock`, or `pollinations` / `live` for real providers. See the provider switch below. |
| `GENERATION_PROVIDER_VIDEO` | Yes | `mock`, or `live` for real providers. |
| `POLLINATIONS_KEY` | Recommended | Sent as a Bearer token. Without it, Pollinations allows only a few new images per IP before answering 402, and quietly swaps `flux` for a smaller model. Free at [enter.pollinations.ai](https://enter.pollinations.ai). |
| `GEMINI_API_KEY` | Optional | Enables Nano Banana (`gemini-2.5-flash-image`) and makes prompt enhancement use Gemini instead of the built-in template. A free-tier key has no image allowance (Google answers 429 with "limit: 0"), so Nano Banana needs billing on the Google AI Studio project. |
| `FAL_KEY` | Optional | Enables Seedance 1.5 Pro image-to-video (480p, 5 credits) through fal's queue API. |
| `POLLINATIONS_BASE_URL` | Testing only | Points Pollinations somewhere else. `http://127.0.0.1:9/` forces a failure, to watch the full refund. |
| `FAL_QUEUE_BASE_URL` | Testing only | Points the fal provider at a stand-in queue server. |

Production currently has `GENERATION_PROVIDER_IMAGE=pollinations`, `GENERATION_PROVIDER_VIDEO=live` and `POLLINATIONS_KEY`. `GEMINI_API_KEY` was removed because the key's free tier cannot generate images, and there is no `FAL_KEY`, so Nano Banana and Seedance show as unavailable and enhancement uses the template.

## The provider switch

Every provider implements one interface (`src/lib/providers/types.ts`): `submit(input)` returns a job id and, for providers that answer at once, the final state; `poll(jobId)` returns pending, running, succeeded with an output URL, or failed with a reason a person can read.

- **`mock`** routes every model of that type to the mock provider, which returns a bundled sample after 3 to 8 seconds. It is the default when a variable is unset.
- **Any other value** sends each model to its own provider:

| Model | Type | Cost | Provider | Needs |
|---|---|---|---|---|
| Soul 2 | image | 0.125 | Pollinations | nothing (`POLLINATIONS_KEY` recommended) |
| FLUX Schnell | image | 0.5 | Pollinations | nothing |
| Nano Banana | image | 2 | Gemini | `GEMINI_API_KEY` with billing |
| Motion preview | video | 1 | motion (no AI video) | a start frame |
| Seedance 1.5 Pro | video | 5 | fal.ai | `FAL_KEY` and a start frame |

Models whose key is missing stay listed but disabled ("needs API key"), and the server refuses them too. Failed generations refund their full cost to the ledger.

## Deploy

The Vercel project auto-deploys from `main`.

1. Install and log in to the CLI: `npm i -g vercel`, then `vercel login`. Run `vercel link` in the repo (it creates `.vercel/`, which is gitignored).
2. Set the variables for Production and Preview:
   ```bash
   vercel env add GENERATION_PROVIDER_IMAGE production --value pollinations --yes
   vercel env add GENERATION_PROVIDER_IMAGE preview "" --value pollinations --yes
   vercel env add GENERATION_PROVIDER_VIDEO production --value live --yes
   vercel env add GENERATION_PROVIDER_VIDEO preview "" --value live --yes
   vercel env add POLLINATIONS_KEY production          # paste the key when prompted
   ```
   The empty `""` branch argument is needed for Preview when running non-interactively; without it the CLI keeps asking which branch.
3. Push to `main`, or redeploy the current build so new variables take effect: `vercel redeploy <deployment-url> --target production`. Variable changes do nothing until the next deploy.
4. Check `/api/capabilities` on the production URL: it should report `imageMode` and `videoMode` as `live` and the keys you set as `true`.

Use the production domain, not the long per-deployment URLs (`clone-higgsfield-<hash>-….vercel.app`). Each of those keeps running the code it was built with, and each origin has its own browser storage.

## Decisions

**No login.** The visitor lands in the Studio with 10 credits and a seeded demo project; the browser is the identity. A reviewer sees the real first-run experience by opening a private window, and there is no sign-up wall, onboarding wizard or interstitial between them and the product.

**No server database.** Projects, generations, favourites, elements, the plan and the credits ledger live in IndexedDB through Dexie. Credits are never stored as a number: the balance is the sum of ledger entries (signup grant, debits, refunds, upgrade grants), so every change is explained in `/account`. The only server code is a few route handlers that proxy the providers so keys stay on the server, plus `/api/enhance`.

**The repository interface.** `src/lib/repo.ts` is the only module that touches the database. The UI and the generation flow call functions such as `getBalance`, `addLedgerEntry`, `listProjects`, `createGeneration`, `getLineage` and `listElements`, and subscribe to changes through `observe`. Moving to a server database later means reimplementing that one file, without touching components.

## What I changed and why

These are the eight gaps from the "Observed behaviour" notes in `CONTEXT.md`, with the screenshot that shows each one in the original.

1. **One generate bar.** The original's bar changes layout per mode and model, so I kept one bar whose chips stay in a fixed order and disable in place, with a reason, when they don't apply. (`05-landing-after-onboarding.webp`, `08-image-mode-soul.webp`, `11-video-bar-start-frame.webp`)
2. **Balance always visible.** The original hides the balance in the account menu, so it sits in the header on every page and links to the full ledger. (`07-account-menu-10-credits.webp`)
3. **Affordability before Generate.** A new free user's default Generate costs 60 credits against a balance of 10 with no warning, so the button states the cost and what will be left, and explains when you can't afford it. (`05-landing-after-onboarding.webp`)
4. **No silent empty projects.** Generate with an empty prompt quietly creates a new project, so here Generate stays disabled until there is a prompt and never creates anything. (`09-project-workspace-processing.webp`)
5. **Visible prompt enhancement.** Image prompts are rewritten by a hidden enhancer the user is never told about, so enhancement is opt-in, the paragraph is editable before Generate, and the drawer shows exactly what the model received. (`10-image-detail-panel.webp`)
6. **No onboarding wizard.** The seven-step wizard changes nothing afterwards, so there is none; the app opens straight into the Studio. (`04-onboarding-consistency-pitch.webp`)
7. **No interstitials.** A feature popup, a full-screen upsell with a countdown and a modal stack on top of the first visit, so there are none. (`06-upsell-countdown.webp`)
8. **Honest pricing.** Pricing defaults to annual and quotes three different discounts with crossed-out prices, so it defaults to monthly with no promos, shows annual as the monthly rate and the yearly total at the same size, and the confirm page states the exact charge before the button. (`02-pricing-tiers.jpg`, `15-checkout-plus-annual.webp`)
