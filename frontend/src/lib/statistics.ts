import { request, type Stats } from "./api";

export interface StatisticsItem {
  id: number;
  title: string;
  stats: Stats;
}

export interface StatisticsGroup extends StatisticsItem {
  color: string;
  subgroups: StatisticsItem[];
}

export interface StatisticsDay {
  date: string;
  learned: number;
  learned_total: number;
  created: number;
}

export interface StatisticsData {
  summary: Stats;
  groups: StatisticsGroup[];
  distribution: (StatisticsItem & { color: string })[];
  distribution_level: "groups" | "subgroups";
  timeline: StatisticsDay[];
  period: { days: number; start: string; end: string };
  learned_without_date: number;
  review_history_available: boolean;
}

export type StatisticsPeriod = number | "all";

export async function fetchStatistics(days: StatisticsPeriod, groupId: string, subgroupId: string): Promise<StatisticsData> {
  const query = new URLSearchParams({ days: String(days), utc_offset_minutes: String(-new Date().getTimezoneOffset()) });
  if (groupId) query.set("group_id", groupId);
  if (subgroupId) query.set("subgroup_id", subgroupId);
  return request<StatisticsData>(`/statistics?${query}`);
}
