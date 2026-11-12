import type { CalEvent, EventCategory } from "@/data/types";

/**
 * iCalendar (.ics) parser for importing a university timetable.
 * Handles VEVENT with DTSTART/DTEND (date or date-time, UTC or local), SUMMARY,
 * LOCATION, UID and simple weekly RRULEs (FREQ=WEEKLY with COUNT or UNTIL).
 */
export function parseICS(text: string, idPrefix = "ical"): CalEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const events: CalEvent[] = [];
  let cur: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      events.push(...toEvents(cur, idPrefix));
      cur = null;
    } else if (cur) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const key = line.slice(0, idx).split(";")[0].toUpperCase();
      cur[key] = line.slice(idx + 1);
    }
  }
  return events;
}

const unescape = (v: string) => v.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

export function guessCategory(title: string, fallback: EventCategory = "class"): EventCategory {
  const t = title.toLowerCase();
  if (/(exam|midterm|final|klausur|prüfung|examen|exame)/.test(t)) return "exam";
  if (/(deadline|due|assignment|essay|submission|abgabe|entrega|presentation)/.test(t)) return "assignment";
  if (/(lecture|seminar|class|tutorial|vorlesung|übung|clase|aula|lab\b)/.test(t)) return "class";
  if (/(flight|train|trip|flug|vuelo|voo)/.test(t)) return "travel";
  if (/(appointment|termin|cita|bürgeramt|embassy|consulate|bank)/.test(t)) return "admin";
  return fallback;
}

function parseDate(v: string): Date | null {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return new Date(Number(y), Number(mo) - 1, Number(d));
  if (z) return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi)));
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

function toEvents(raw: Record<string, string>, idPrefix: string): CalEvent[] {
  const startRaw = raw["DTSTART"];
  if (!startRaw) return [];
  const start = parseDate(startRaw);
  if (!start) return [];
  const timed = startRaw.includes("T");
  const title = unescape(raw["SUMMARY"] ?? "Untitled event");
  const place = raw["LOCATION"] ? unescape(raw["LOCATION"]) : undefined;
  const uid = raw["UID"] ?? `${iso(start)}-${title}`;

  let endDate: string | undefined;
  if (!timed && raw["DTEND"]) {
    const end = parseDate(raw["DTEND"]);
    if (end) {
      end.setDate(end.getDate() - 1); // exclusive end
      if (iso(end) > iso(start)) endDate = iso(end);
    }
  }

  const base = (d: Date, n: number): CalEvent => ({
    id: `${idPrefix}-${uid}${n ? `-${n}` : ""}`,
    title,
    date: iso(d),
    endDate,
    time: timed ? hhmm(d) : undefined,
    place,
    category: guessCategory(title),
    source: "ical",
  });

  const rrule = raw["RRULE"];
  if (!rrule || !/FREQ=WEEKLY/i.test(rrule)) return [base(start, 0)];

  const count = Number(rrule.match(/COUNT=(\d+)/i)?.[1] ?? 0);
  const until = rrule.match(/UNTIL=([0-9TZ]+)/i)?.[1];
  const untilDate = until ? parseDate(until) : null;
  const interval = Number(rrule.match(/INTERVAL=(\d+)/i)?.[1] ?? 1);
  const out: CalEvent[] = [];
  const max = count || 40;
  for (let i = 0; i < max; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i * 7 * interval);
    if (untilDate && d > untilDate) break;
    out.push(base(d, i));
  }
  return out;
}
