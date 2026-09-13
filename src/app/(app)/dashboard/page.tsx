import type { Metadata } from "next";
import QuestBoard from "@/components/QuestBoard";

export const metadata: Metadata = {
  title: "Quest Board",
  description: "Accept, complete, and conquer your daily quests.",
};

export default function DashboardPage() {
  return <QuestBoard />;
}
