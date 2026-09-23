import ReviewScreen from "@/components/ReviewScreen";
import "../review-area.css";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ all?: string; from?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <ReviewScreen
      key={`${id}-${query.all}`}
      id={Number(id)}
      practice={query.all === "1"}
      from={query.from}
    />
  );
}
