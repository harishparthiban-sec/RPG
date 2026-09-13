import type { Metadata } from "next";
import CharacterSheet from "@/components/CharacterSheet";

export const metadata: Metadata = {
  title: "Character Sheet",
  description: "Your level, attributes, streaks, and gold ledger.",
};

export default function CharacterPage() {
  return <CharacterSheet />;
}
