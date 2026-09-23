import GroupScreen from "@/components/GroupScreen";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  return (
    <GroupScreen
      key={`${id}-${view}`}
      id={Number(id)}
      learned={view === "learned"}
    />
  );
}
