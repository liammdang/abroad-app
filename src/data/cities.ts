import { berlin } from "./berlin";
import { madrid } from "./madrid";
import { lisbon } from "./lisbon";
import type { City, CityId, EventCategory, SpotCategory } from "./types";

export const CITIES: Record<CityId, City> = { berlin, madrid, lisbon };
export const CITY_LIST: City[] = [berlin, madrid, lisbon];

export const INTERESTS = [
  "Coffee & Study",
  "Budget Travel",
  "Language Exchange",
  "Food Markets",
  "Nightlife",
  "Museums & Culture",
  "Sports & Outdoors",
  "Photography",
];

export const SPOT_CATEGORIES: { id: SpotCategory; label: string }[] = [
  { id: "study", label: "Study cafés" },
  { id: "eats", label: "Cheap eats" },
  { id: "culture", label: "Culture" },
  { id: "nightlife", label: "Nightlife" },
];

export const spotCategoryLabel = (c: SpotCategory) => SPOT_CATEGORIES.find((s) => s.id === c)!.label;

export const EVENT_CATEGORIES: { id: EventCategory; label: string; color: string }[] = [
  { id: "class", label: "Class", color: "bg-cat-class" },
  { id: "exam", label: "Exam", color: "bg-cat-exam" },
  { id: "assignment", label: "Assignment", color: "bg-cat-assignment" },
  { id: "admin", label: "Admin", color: "bg-cat-admin" },
  { id: "travel", label: "Travel", color: "bg-cat-travel" },
  { id: "social", label: "Social", color: "bg-cat-social" },
];

export const categoryColor = (c: EventCategory) => EVENT_CATEGORIES.find((e) => e.id === c)!.color;
export const categoryLabel = (c: EventCategory) => EVENT_CATEGORIES.find((e) => e.id === c)!.label;

export const mapsUrl = (query: string, city: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query}, ${city}`)}`;
