import { Studio } from "@/components/studio/studio";

// The project name comes from this browser's database, so the Studio sets it once loaded.
export const metadata = { title: "Studio · Afterglow" };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <Studio projectId={projectId} />;
}
