import Link from "next/link";

export const metadata = { title: "Not found · Afterglow" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">This page doesn&apos;t exist.</h1>
      <Link
        href="/p/demo"
        className="rounded-pill border border-line px-4 py-1.5 text-sm text-text transition-colors hover:bg-panel"
      >
        Open the Studio
      </Link>
    </div>
  );
}
