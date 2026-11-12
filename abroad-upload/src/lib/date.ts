/**
 * The demo runs on a fixed "today" so the sample semester always looks alive.
 * To use the real date instead, set USE_REAL_TODAY to true.
 */
export const USE_REAL_TODAY = false;
export const DEMO_TODAY = "2026-10-12";

export function todayISO(): string {
  if (!realToday) return DEMO_TODAY;
  const d = new Date();
  return toISO(d);
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const weekdayLong = (iso: string) => WEEKDAYS[parseISO(iso).getDay()];
export const weekdayShort = (iso: string) => WEEKDAYS[parseISO(iso).getDay()].slice(0, 3);
export const monthLong = (m: number) => MONTHS[m];
export const monthShort = (iso: string) => MONTHS[parseISO(iso).getMonth()].slice(0, 3);
export const dayNum = (iso: string) => parseISO(iso).getDate();

/** "Monday, October 12" */
export const heroDate = (iso: string) => `${weekdayLong(iso)}, ${monthLong(parseISO(iso).getMonth())} ${dayNum(iso)}`;
/** "Friday, 30 October" */
export const panelDate = (iso: string) => `${weekdayLong(iso)}, ${dayNum(iso)} ${monthLong(parseISO(iso).getMonth())}`;
/** "TUE 13 OCT" */
export const stampDate = (iso: string) => `${weekdayShort(iso)} ${dayNum(iso)} ${monthShort(iso)}`.toUpperCase();
/** "Thu, Oct 15" */
export const shortDate = (iso: string) => `${weekdayShort(iso)}, ${monthShort(iso)} ${dayNum(iso)}`;
/** "Oct 23–25" or "Oct 30–Nov 1" */
export function rangeLabel(start: string, end: string) {
  const s = parseISO(start), e = parseISO(end);
  if (s.getMonth() === e.getMonth()) return `${monthShort(start)} ${s.getDate()}–${e.getDate()}`;
  return `${monthShort(start)} ${s.getDate()}–${monthShort(end)} ${e.getDate()}`;
}

export function addDays(iso: string, n: number) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Live (signed-in) mode uses the real date; demo mode uses DEMO_TODAY. */
let realToday = USE_REAL_TODAY;
export function setRealToday(v: boolean) {
  realToday = v || USE_REAL_TODAY;
}

export function diffDays(fromISO: string, toISODate: string) {
  return Math.round((parseISO(toISODate).getTime() - parseISO(fromISO).getTime()) / 86_400_000);
}

/** Which Life Admin phase fits today, based on the stay dates. */
export function currentPhase(today: string, start: string, end: string): "pre" | "first14" | "month" | "departure" {
  if (today < start) return "pre";
  if (diffDays(today, end) <= 30) return "departure";
  return diffDays(start, today) < 14 ? "first14" : "month";
}

/** "Day 12 of 151", "Arriving in 5 days", … */
export function stayLabel(today: string, start: string, end: string) {
  if (today < start) {
    const n = diffDays(today, start);
    return n === 1 ? "Arriving tomorrow" : `Arriving in ${n} days`;
  }
  if (today > end) return "Stay completed";
  return `Day ${diffDays(start, today) + 1} of ${diffDays(start, end) + 1}`;
}
