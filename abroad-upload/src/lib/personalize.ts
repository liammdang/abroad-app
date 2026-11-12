import type { SpotCategory } from "@/data/types";

/** How each onboarding interest maps to spot categories and meetup categories. */
const INTEREST_MAP: Record<string, { spots?: SpotCategory[]; meetups?: string[] }> = {
  "Coffee & Study": { spots: ["study"], meetups: ["Coffee & Study"] },
  "Language Exchange": { meetups: ["Language Exchange"] },
  "Food Markets": { spots: ["eats"], meetups: ["Food Markets"] },
  Nightlife: { spots: ["nightlife"], meetups: ["Nightlife"] },
  "Museums & Culture": { spots: ["culture"], meetups: ["Culture"] },
  "Sports & Outdoors": { meetups: ["Sports & Outdoors"] },
  Photography: { meetups: ["Photography"] },
  "Budget Travel": { spots: ["eats"] },
};

export const MEETUP_CATEGORIES = [
  "Language Exchange",
  "Food Markets",
  "Coffee & Study",
  "Nightlife",
  "Culture",
  "Sports & Outdoors",
  "Photography",
];

export const spotMatches = (cat: SpotCategory, interests: string[]) =>
  interests.some((i) => INTEREST_MAP[i]?.spots?.includes(cat));

export const meetupMatches = (cat: string, interests: string[]) =>
  interests.some((i) => INTEREST_MAP[i]?.meetups?.includes(cat));

/** Stable sort: matching items first, original order otherwise. */
export function forYouFirst<T>(items: T[], match: (t: T) => boolean): T[] {
  return [...items.filter(match), ...items.filter((t) => !match(t))];
}
