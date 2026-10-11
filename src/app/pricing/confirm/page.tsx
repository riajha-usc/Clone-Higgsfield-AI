import { ConfirmUpgrade } from "@/components/pricing/confirm-upgrade";

export const metadata = { title: "Confirm upgrade · Afterglow" };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[]; term?: string | string[] }>;
}) {
  const { plan, term } = await searchParams;
  return (
    <ConfirmUpgrade
      planId={typeof plan === "string" ? plan : undefined}
      termValue={typeof term === "string" ? term : undefined}
    />
  );
}
