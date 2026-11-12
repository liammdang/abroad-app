/** Cities with hand-made content (used in demo mode and as a fallback). */
export type BuiltInCityId = "berlin" | "madrid" | "lisbon";
/** Any city: a built-in id or a slug like "cologne" for AI-personalized cities. */
export type CityId = string;

export type EventCategory = "class" | "exam" | "assignment" | "admin" | "travel" | "social";

export type PhaseId = "pre" | "first14" | "month" | "departure";

export interface Task {
  id: string;
  title: string;
  summary: string;
  documents: string[];
  tip: string;
  samples: string[];
  mapsQuery?: string;
  /** ids of tasks that should be done first */
  dependsOn?: string[];
}

export interface Phase {
  id: PhaseId;
  label: string;
  items: Task[];
}

export type SpotCategory = "study" | "eats" | "culture" | "nightlife";

export interface Spot {
  id: string;
  name: string;
  category: SpotCategory;
  description: string;
  area: string;
  price: string;
  rating: number;
}

export interface Meetup {
  id: string;
  category: string;
  title: string;
  date: string; // ISO
  time: string;
  place: string;
  /** people going, not counting the current user */
  going: number;
}

export interface Trip {
  id: string;
  destination: string;
  start: string;
  end: string;
  cost: number;
  host: string;
  description: string;
  /** total group size the host is planning for */
  capacity: number;
  /** initials of other people coming (not the current user) */
  attendees: string[];
}

export interface CalEvent {
  id: string;
  title: string;
  date: string; // ISO
  endDate?: string;
  time?: string;
  place?: string;
  category: EventCategory;
  source?: "sample" | "trip" | "meetup" | "ical" | "google" | "stay" | "upload" | "manual" | "plan";
}

export type MailFolder = "university" | "immigration" | "housing";

export interface Mail {
  id: string;
  from: string;
  subject: string;
  preview: string;
  when: string;
  folder: MailFolder;
  /** Gmail thread id, set for real messages */
  threadId?: string;
}

export interface City {
  id: CityId;
  name: string;
  country: string;
  flag: string;
  greeting: string;
  universities: string[];
  /** email domain per university, used by the Smart Email university filter */
  universityDomains: Record<string, string>;
  phases: Phase[];
  spots: Spot[];
  meetups: Meetup[];
  trips: Trip[];
  events: CalEvent[];
  inbox: Mail[];
  mailRules: { immigration: string[]; housing: string[] };
  ai: { question: string; answer: string };
  /** AI-personalized extras */
  apps?: import("./apps").EssentialApp[];
  keyDates?: KeyDate[];
  summary?: string;
  personalized?: boolean;
}

export interface KeyDate {
  title: string;
  date: string; // ISO
  category: EventCategory;
}

/** Everything Gemini generates for one student during onboarding. Stored in profiles.city_pack. */
export interface CityPack {
  city: string;
  country: string;
  flag: string;
  greeting: string;
  summary: string;
  universityDomain?: string;
  phases: Phase[];
  spots: Spot[];
  apps: import("./apps").EssentialApp[];
  keyDates: KeyDate[];
  mailRules: { immigration: string[]; housing: string[] };
  ai: { question: string; answer: string };
  generatedAt: string;
}
