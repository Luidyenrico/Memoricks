import ThemesScreen from "@/components/HomeScreen";

export default async function Page({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group } = await searchParams;
  return <ThemesScreen initialGroup={group && Number.isFinite(Number(group)) ? Number(group) : undefined} />;
}
