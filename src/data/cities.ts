import { berlin } from "./berlin";
import { madrid } from "./madrid";
import { lisbon } from "./lisbon";
import type { BuiltInCityId, City, CityPack, EventCategory, Phase, SpotCategory } from "./types";

export const CITIES: Record<BuiltInCityId, City> = { berlin, madrid, lisbon };
export const CITY_LIST: City[] = [berlin, madrid, lisbon];
export const builtInCity = (id: string): City | undefined => CITIES[id as BuiltInCityId];

/** Quick picks in onboarding. Any other city can be typed in. */
export const POPULAR_CITIES: { name: string; country: string; flag: string }[] = [
  { name: "Berlin", country: "Germany", flag: "🇩🇪" },
  { name: "Madrid", country: "Spain", flag: "🇪🇸" },
  { name: "Lisbon", country: "Portugal", flag: "🇵🇹" },
  { name: "Cologne", country: "Germany", flag: "🇩🇪" },
  { name: "Munich", country: "Germany", flag: "🇩🇪" },
  { name: "Paris", country: "France", flag: "🇫🇷" },
  { name: "Amsterdam", country: "Netherlands", flag: "🇳🇱" },
  { name: "Barcelona", country: "Spain", flag: "🇪🇸" },
  { name: "Milan", country: "Italy", flag: "🇮🇹" },
  { name: "Vienna", country: "Austria", flag: "🇦🇹" },
  { name: "Prague", country: "Czechia", flag: "🇨🇿" },
  { name: "Copenhagen", country: "Denmark", flag: "🇩🇰" },
  { name: "Dublin", country: "Ireland", flag: "🇮🇪" },
  { name: "London", country: "United Kingdom", flag: "🇬🇧" },
  { name: "Seoul", country: "South Korea", flag: "🇰🇷" },
  { name: "Tokyo", country: "Japan", flag: "🇯🇵" },
  { name: "Sydney", country: "Australia", flag: "🇦🇺" },
  { name: "Toronto", country: "Canada", flag: "🇨🇦" },
];

export const PROGRAMS = ["Exchange semester", "Erasmus+", "Full degree", "Master's", "Summer school", "Internship", "Language course", "Work & travel"];

export const INTERESTS = [
  "Coffee & Study",
  "Budget Travel",
  "Language Exchange",
  "Food Markets",
  "Street Food",
  "Cooking",
  "Vegetarian / Vegan",
  "Nightlife",
  "Clubbing & Parties",
  "Live Music",
  "Museums & Culture",
  "Art & Galleries",
  "History",
  "Theatre & Film",
  "Reading & Libraries",
  "Sports & Outdoors",
  "Hiking & Nature",
  "Gym & Fitness",
  "Football",
  "Running",
  "Cycling",
  "Photography",
  "Volunteering",
  "Gaming",
  "Fashion & Shopping",
  "Startups & Networking",
  "Religion & Spirituality",
];

export const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "city";

export const flagFor = (country: string) => POPULAR_CITIES.find((c) => c.country.toLowerCase() === country.trim().toLowerCase())?.flag ?? "🌍";

const t = (id: string, title: string, summary: string, documents: string[], tip: string, mapsQuery?: string) => ({
  id: `gen-${id}`,
  title,
  summary,
  documents,
  tip,
  samples: [],
  mapsQuery,
});

/** Generic checklist for a city without AI content yet (works anywhere). */
const GENERIC_PHASES: Phase[] = [
  {
    id: "pre",
    label: "Pre-Departure",
    items: [
      t("visa", "Check your visa or residence permit", "Find out which visa or permit you need for your stay and apply early.", ["Passport", "Admission letter", "Proof of funds", "Health insurance"], "Embassy appointments can take weeks — book as soon as you have your admission letter."),
      t("insurance", "Get health insurance", "Most countries require proof of health insurance for students.", ["Passport", "Admission letter"], "Ask your university which insurance they accept before you buy one."),
      t("housing", "Find a place to live", "Secure at least a temporary room for your first weeks.", ["Passport copy", "Admission letter", "Proof of income or guarantor"], "Never pay a deposit before seeing the contract — rental scams are common."),
      t("docs", "Copy your important documents", "Keep digital and paper copies of passport, visa, insurance and admission letter.", [], "Save them in a cloud folder you can open from any phone."),
    ],
  },
  {
    id: "first14",
    label: "First 14 Days",
    items: [
      t("register", "Register your address", "Many countries require you to register where you live soon after arrival.", ["Passport", "Rental contract", "Landlord confirmation"], "Book the appointment online before you arrive if you can.", "city registration office"),
      t("enrol", "Enrol at your university", "Finish enrolment at the international office and get your student ID.", ["Passport", "Admission letter", "Insurance proof"], "Ask about student discounts on transport while you are there.", "international office"),
      t("sim", "Get a local SIM card", "A local number makes banking, housing and appointments much easier.", ["Passport"], "Prepaid plans need no contract and are easy to cancel."),
      t("transport", "Get a transport pass", "Student passes are usually much cheaper than single tickets.", ["Student ID", "Passport photo"], "Check whether your semester fee already includes a transport ticket."),
    ],
  },
  {
    id: "month",
    label: "First Month",
    items: [
      t("bank", "Open a bank account", "A local account (IBAN) is often needed for rent, salary and phone contracts.", ["Passport", "Address registration", "Student ID"], "Online banks are often faster for international students."),
      t("permit", "Apply for your residence permit", "If your visa is temporary, apply for the residence permit before it expires.", ["Passport", "Address registration", "Insurance", "Proof of funds", "Biometric photo"], "Appointments fill up fast — book in your first week.", "immigration office"),
      t("doctor", "Find a doctor", "Register with a general doctor or know where the nearest clinic is.", ["Insurance card"], "Save the local emergency number (112 in the EU) in your phone."),
    ],
  },
  {
    id: "departure",
    label: "Departure",
    items: [
      t("deregister", "De-register your address", "Tell the city office you are leaving.", ["Passport", "Moving-out date"], "Some cities let you do this online."),
      t("deposit", "Get your deposit back", "Hand over the room and agree on the deposit return in writing.", ["Rental contract", "Handover protocol", "Bank details"], "Take photos of the room on the day you move out."),
      t("close", "Close accounts and contracts", "Cancel phone, gym, insurance and bank accounts you no longer need.", [], "Check notice periods a month before you leave."),
    ],
  },
];

/** A city we have no hand-made or AI content for yet. */
export function genericCity(name: string, country: string, university: string): City {
  return {
    id: slugify(name),
    name,
    country,
    flag: flagFor(country),
    greeting: "Hello",
    universities: [university],
    universityDomains: {},
    phases: GENERIC_PHASES,
    spots: [],
    meetups: [],
    trips: [],
    events: [],
    inbox: [],
    mailRules: { immigration: ["visa", "residence permit", "immigration", "appointment"], housing: ["rent", "deposit", "landlord", "lease"] },
    ai: { question: `What should I do first in ${name}?`, answer: "Start with your address registration and residence permit — your AI Companion can walk you through it." },
  };
}

/** Turn the AI-generated pack into the City shape the pages use. */
export function cityFromPack(pack: CityPack, university: string): City {
  return {
    id: slugify(pack.city),
    name: pack.city,
    country: pack.country,
    flag: pack.flag || flagFor(pack.country),
    greeting: pack.greeting || "Hello",
    universities: [university],
    universityDomains: pack.universityDomain ? { [university]: pack.universityDomain } : {},
    phases: pack.phases,
    spots: pack.spots,
    meetups: [],
    trips: [],
    events: [],
    inbox: [],
    mailRules: pack.mailRules,
    ai: pack.ai,
    apps: pack.apps,
    keyDates: pack.keyDates,
    summary: pack.summary,
    personalized: true,
  };
}

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
