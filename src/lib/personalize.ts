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
  "Street Food": { spots: ["eats"], meetups: ["Food Markets"] },
  "Cooking": { spots: ["eats"], meetups: ["Food Markets"] },
  "Vegetarian / Vegan": { spots: ["eats"] },
  "Clubbing & Parties": { spots: ["nightlife"], meetups: ["Nightlife"] },
  "Live Music": { spots: ["nightlife", "culture"], meetups: ["Nightlife", "Culture"] },
  "Art & Galleries": { spots: ["culture"], meetups: ["Culture"] },
  "History": { spots: ["culture"], meetups: ["Culture"] },
  "Theatre & Film": { spots: ["culture"], meetups: ["Culture"] },
  "Reading & Libraries": { spots: ["study"], meetups: ["Coffee & Study"] },
  "Hiking & Nature": { meetups: ["Sports & Outdoors"] },
  "Gym & Fitness": { meetups: ["Sports & Outdoors"] },
  "Football": { meetups: ["Sports & Outdoors"] },
  "Running": { meetups: ["Sports & Outdoors"] },
  "Cycling": { meetups: ["Sports & Outdoors"] },
  "Volunteering": { meetups: ["Language Exchange"] },
  "Gaming": { spots: ["nightlife"] },
  "Fashion & Shopping": { spots: ["culture"] },
  "Startups & Networking": { spots: ["study"], meetups: ["Coffee & Study"] },
  "Religion & Spirituality": { spots: ["culture"] },
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
