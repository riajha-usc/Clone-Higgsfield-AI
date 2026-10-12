import Link from "next/link";

export const metadata = { title: "About · Afterglow" };

const CHANGES = [
  {
    title: "No login",
    body: "You land in the Studio with 10 credits and a demo project. Everything is stored in this browser, so a private window starts fresh.",
  },
  {
    title: "Balance always visible",
    body: "Your credits sit in the header on every page, and the Generate button says what a generation costs and what you will have left.",
  },
  {
    title: "Preset previews",
    body: "Video is a motion preview: your start frame animated with a named camera preset. It is labelled as that, not passed off as AI video, and it still costs credits so the ledger is real.",
  },
  {
    title: "One bar",
    body: "Images and video share one generate bar. Options that do not apply are disabled in place instead of the layout changing per model. Prompt enhancement is opt-in and you can read and edit it before anything is sent.",
  },
  {
    title: "Honest pricing",
    body: "Monthly is the default, with no countdowns, personal promos or crossed-out prices. The confirm page states the exact charge in one sentence before the button.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>

      <section aria-labelledby="what" className="mt-8">
        <h2 id="what" className="text-lg font-semibold">
          What this is
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">
          A working clone of the core loop of an AI image and video generator: type a prompt, pick a model, generate,
          get a file. Generations live in projects, every one costs credits from a visible ledger, and each result
          opens into a detail view that shows how it was made. It runs on free tiers: images come from Pollinations
          (or Gemini when a key is set) and nothing here takes payment.
        </p>
      </section>

      <section aria-labelledby="changes" className="mt-10">
        <h2 id="changes" className="text-lg font-semibold">
          What it changes versus the original
        </h2>
        <dl className="mt-4 space-y-4">
          {CHANGES.map((change) => (
            <div key={change.title} className="rounded-card border border-line bg-panel p-4">
              <dt className="text-sm font-medium">{change.title}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-text-muted">{change.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link
        href="/p/demo"
        className="mt-10 inline-flex h-11 items-center justify-center rounded-xl bg-lime px-6 text-sm font-semibold text-lime-foreground transition-[filter] hover:brightness-95"
      >
        Open the Studio
      </Link>
    </div>
  );
}
