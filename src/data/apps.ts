import type { CityId } from "./types";

export type AppCategory = "transport" | "money" | "housing" | "food" | "health" | "everyday";

export interface EssentialApp {
  id: string;
  name: string;
  category: AppCategory;
  why: string;
  /** must-have before you arrive */
  essential?: boolean;
}

export const APP_CATEGORIES: { id: AppCategory; label: string }[] = [
  { id: "transport", label: "Transport" },
  { id: "money", label: "Money" },
  { id: "housing", label: "Housing" },
  { id: "food", label: "Food" },
  { id: "health", label: "Health" },
  { id: "everyday", label: "Everyday" },
];

const COMMON: EssentialApp[] = [
  { id: "app-gmaps", name: "Google Maps", category: "transport", why: "Live public transport routes, offline maps and opening hours.", essential: true },
  { id: "app-wise", name: "Wise", category: "money", why: "Send money from home and pay in euros with low fees.", essential: true },
  { id: "app-revolut", name: "Revolut", category: "money", why: "Free EU account and card while your local bank account is pending." },
  { id: "app-whatsapp", name: "WhatsApp", category: "everyday", why: "How classmates, landlords and student groups talk to each other.", essential: true },
  { id: "app-translate", name: "Google Translate", category: "everyday", why: "Camera translation for letters, forms and menus." },
  { id: "app-deepl", name: "DeepL", category: "everyday", why: "More natural translations for emails to offices and landlords." },
  { id: "app-tgtg", name: "Too Good To Go", category: "food", why: "Cheap leftover food bags from bakeries and restaurants." },
];

const BY_CITY: Record<CityId, EssentialApp[]> = {
  berlin: [
    { id: "app-bvg", name: "BVG Fahrinfo", category: "transport", why: "Berlin's U-Bahn, S-Bahn, tram and bus times plus tickets.", essential: true },
    { id: "app-db", name: "DB Navigator", category: "transport", why: "Deutsche Bahn trains and the Deutschlandticket across Germany.", essential: true },
    { id: "app-jelbi", name: "Jelbi", category: "transport", why: "BVG's app for bikes, e-scooters and car sharing in one place." },
    { id: "app-n26", name: "N26", category: "money", why: "German bank account (IBAN) you can open from your phone." },
    { id: "app-wggesucht", name: "WG-Gesucht", category: "housing", why: "The main site for shared flats (WGs) and short-term rooms.", essential: true },
    { id: "app-kleinanzeigen", name: "Kleinanzeigen", category: "housing", why: "Second-hand furniture, bikes and kitchen stuff." },
    { id: "app-doctolib", name: "Doctolib", category: "health", why: "Book doctor appointments online, many in English." },
    { id: "app-lieferando", name: "Lieferando", category: "food", why: "Food delivery across Berlin." },
    { id: "app-wolt", name: "Wolt", category: "food", why: "Food and grocery delivery." },
  ],
  madrid: [
    { id: "app-metromad", name: "Metro de Madrid", category: "transport", why: "Official metro map, live times and line alerts.", essential: true },
    { id: "app-emt", name: "EMT Madrid", category: "transport", why: "City buses, live arrivals and BiciMAD bike share.", essential: true },
    { id: "app-renfe", name: "Renfe", category: "transport", why: "Cercanías commuter trains and trips across Spain." },
    { id: "app-cabify", name: "Cabify", category: "transport", why: "Spain's ride-hailing app, often cheaper than taxis." },
    { id: "app-bizum", name: "Bizum", category: "money", why: "Instant payments between friends. It lives inside your Spanish bank's app." },
    { id: "app-idealista", name: "Idealista", category: "housing", why: "The main site for flats and rooms in Spain.", essential: true },
    { id: "app-wallapop", name: "Wallapop", category: "housing", why: "Second-hand furniture, bikes and electronics." },
    { id: "app-doctoralia", name: "Doctoralia", category: "health", why: "Find and book doctors, including private clinics." },
    { id: "app-glovo", name: "Glovo", category: "food", why: "Food, groceries and pharmacy delivery." },
  ],
  lisbon: [
    { id: "app-navegante", name: "Navegante", category: "transport", why: "Top up your Navegante pass for metro, buses, trams and trains.", essential: true },
    { id: "app-carris", name: "Carris", category: "transport", why: "Lisbon's buses, trams and elevators with live times.", essential: true },
    { id: "app-cp", name: "CP – Comboios de Portugal", category: "transport", why: "Trains to Sintra, Cascais, Porto and the rest of Portugal." },
    { id: "app-bolt", name: "Bolt", category: "transport", why: "Ride-hailing and e-scooters, widely used in Lisbon." },
    { id: "app-mbway", name: "MB WAY", category: "money", why: "Pay friends and shops with your phone number. Works with Portuguese banks." },
    { id: "app-idealista-pt", name: "Idealista", category: "housing", why: "The main site for flats and rooms in Portugal.", essential: true },
    { id: "app-olx", name: "OLX", category: "housing", why: "Second-hand furniture, bikes and more." },
    { id: "app-sns24", name: "SNS 24", category: "health", why: "Portugal's public health service: advice line and appointments." },
    { id: "app-glovo-pt", name: "Glovo", category: "food", why: "Food and grocery delivery." },
  ],
};

export const appsFor = (city: CityId): EssentialApp[] => [...BY_CITY[city], ...COMMON];

/** Opens the store search for this app on the visitor's device. */
export function storeLink(name: string): string {
  const q = encodeURIComponent(name);
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return `itms-apps://search.itunes.apple.com/WebObjects/MZSearch.woa/wa/search?media=software&term=${q}`;
  return `https://play.google.com/store/search?q=${q}&c=apps`;
}
