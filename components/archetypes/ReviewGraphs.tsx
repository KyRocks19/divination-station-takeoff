"use client";

import { EncyclopediaContent } from "@/app/encyclopedia/page";

/** The Tarot Library's pictures of the concepts and cards, for the Graphs tab of /archetypes/review. */
export default function ReviewGraphs() {
  return <EncyclopediaContent views={["graph", "web", "cluster", "cloud"]} start="graph" />;
}
