import SubgroupScreen from "@/components/SubgroupScreen";
import { redirect } from "next/navigation";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; all?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  if (query.view === "review")
    redirect(`/review/${id}${query.all === "1" ? "?all=1" : ""}`);
  const view = ["overview", "review", "active", "learned", "settings"].includes(
    query.view || "",
  )
    ? query.view!
    : "overview";
  return (
    <SubgroupScreen
      key={`${id}-${view}-${query.all}`}
      id={Number(id)}
      view={view}
    />
  );
}
