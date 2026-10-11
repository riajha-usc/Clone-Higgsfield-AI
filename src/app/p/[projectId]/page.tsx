import { Studio } from "@/components/studio/studio";

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <Studio projectId={projectId} />;
}
