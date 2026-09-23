import type { Metadata } from "next";
import StatisticsScreen from "@/components/StatisticsScreen";
import "./statistics.css";

export const metadata: Metadata = { title: "Estatísticas | Memoricks" };

export default function Page() {
  return <StatisticsScreen />;
}
