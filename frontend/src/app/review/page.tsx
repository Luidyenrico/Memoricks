import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group } = await searchParams;
  redirect(group && Number.isFinite(Number(group)) ? `/themes?group=${Number(group)}` : "/themes");
}
