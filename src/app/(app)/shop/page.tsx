import type { Metadata } from "next";
import Shop from "@/components/Shop";

export const metadata: Metadata = {
  title: "Guild Emporium",
  description: "Spend your hard-earned gold on themes, titles, and relics.",
};

export default function ShopPage() {
  return <Shop />;
}
