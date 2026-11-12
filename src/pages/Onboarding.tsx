import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, Plus, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Layout";
import { cn } from "@/components/ui";
import { builtInCity, flagFor, INTERESTS, POPULAR_CITIES, PROGRAMS, slugify } from "@/data/cities";
import { generatePack } from "@/lib/ai";
import { toast } from "@/lib/toast";
import { useApp, type Profile } from "@/state/AppState";

const STEPS = ["Destination", "Your stay", "About you"];

const HOME_COUNTRIES = [
  "Vietnam", "China", "India", "Indonesia", "Philippines", "Thailand", "Malaysia", "Singapore", "Japan", "South Korea",
  "United States", "Canada", "Mexico", "Brazil", "Argentina", "Colombia", "Chile",
  "Germany", "France", "Spain", "Italy", "Portugal", "Netherlands", "Poland", "Ukraine", "Turkey", "United Kingdom", "Ireland",
  "Nigeria", "Egypt", "Morocco", "South Africa", "Kenya", "Australia", "New Zealand", "Pakistan", "Bangladesh", "Iran",
];

const LOADING_STEPS = (d: Profile) => [
  `Reading your profile, ${d.name || "friend"}`,
  `Checking visa & residence rules for ${d.homeCountry || "your passport"} → ${d.country || d.cityName}`,
  `Building your Life Admin checklist for ${d.cityName}`,
  `Finding spots for ${d.interests.slice(0, 2).join(" & ") || "students"}`,
  `Picking the apps you need in ${d.cityName}`,
  "Adding key dates to your calendar",
  "Almost there…",
];

export default function Onboarding() {
  const app = useApp();
  const navigate = useNavigate();
  const live = app.mode === "live";
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(() => {
    const p = app.profile;
    const b = builtInCity(p.cityId);
    return { ...p, cityName: p.cityName ?? b?.name ?? p.cityId, country: p.country ?? b?.country ?? "" };
  });
  const [query, setQuery] = useState("");
  const [customInterest, setCustomInterest] = useState("");
  const [phase, setPhase] = useState<"form" | "loading" | "error">("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const builtIn = builtInCity(slugify(draft.cityName ?? ""));
  const universities = builtIn?.universities ?? [];
  const [customUni, setCustomUni] = useState(() => !universities.includes(app.profile.university));

  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }));

  const pickCity = (name: string, country: string) => {
    const b = builtInCity(slugify(name));
    const changed = name.toLowerCase() !== (draft.cityName ?? "").toLowerCase();
    set({ cityName: name, country, cityId: slugify(name), university: changed ? (b?.universities[0] ?? "") : draft.university });
    if (changed) setCustomUni(!b);
    setQuery("");
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return POPULAR_CITIES;
    return POPULAR_CITIES.filter((c) => c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q));
  }, [query]);

  // "Paris, France" or "Hanoi Vietnam" typed by hand
  const typed = (() => {
    const raw = query.trim();
    if (!raw) return null;
    const [name, ...rest] = raw.split(",").map((s) => s.trim());
    return { name: name.replace(/\b\w/g, (c) => c.toUpperCase()), country: rest.join(", ") };
  })();

  const interests = [...INTERESTS, ...draft.interests.filter((i) => !INTERESTS.includes(i))];
  const toggleInterest = (i: string) =>
    setDraft((d) => ({ ...d, interests: d.interests.includes(i) ? d.interests.filter((x) => x !== i) : [...d.interests, i] }));
  const addCustomInterest = () => {
    const v = customInterest.trim();
    if (v && !draft.interests.includes(v)) setDraft((d) => ({ ...d, interests: [...d.interests, v] }));
    setCustomInterest("");
  };

  const canNext =
    (step === 0 && !!draft.cityName?.trim() && !!draft.country?.trim()) ||
    (step === 1 && !!draft.university.trim() && !!draft.start && !!draft.end && draft.end >= draft.start) ||
    (step === 2 && !!draft.name.trim());

  const clean = (): Profile => ({
    ...draft,
    name: draft.name.trim(),
    university: draft.university.trim(),
    cityName: draft.cityName?.trim(),
    country: draft.country?.trim(),
    cityId: slugify(draft.cityName ?? ""),
    homeCountry: draft.homeCountry?.trim() || undefined,
    about: draft.about?.trim() || undefined,
  });

  const save = async (p: Profile) => {
    setSaving(true);
    try {
      await app.setProfile(p);
      navigate("/");
      window.setTimeout(() => toast(p.pack ? `Your plan for ${p.cityName} is ready ✨` : `All set for ${p.cityName}!`), 50);
    } catch {
      setSaving(false);
    }
  };

  const personalize = async () => {
    const p = clean();
    if (!live) return save({ ...p, pack: null });
    setPhase("loading");
    try {
      const pack = await generatePack({
        name: p.name,
        city: p.cityName ?? "",
        country: p.country,
        university: p.university,
        start: p.start,
        end: p.end,
        interests: p.interests,
        homeCountry: p.homeCountry,
        program: p.program,
        about: p.about,
        today: app.today,
      });
      await save({ ...p, cityName: pack.city || p.cityName, cityId: slugify(pack.city || p.cityName || ""), pack });
    } catch (e) {
      setErrorMsg((e as Error).message);
      setPhase("error");
    }
  };

  if (phase !== "form") {
    return (
      <PersonalizingScreen
        draft={draft}
        error={phase === "error" ? errorMsg : ""}
        saving={saving}
        onRetry={() => void personalize()}
        onSkip={() => void save({ ...clean(), pack: null })}
        onBack={() => setPhase("form")}
      />
    );
  }

  return (
    <div className="flex min-h-full items-start justify-center bg-canvas px-4 py-10 md:items-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-center gap-3">
          <Logo />
          <div>
            <p className="font-display text-2xl font-bold">Abroad</p>
            <p className="text-sm font-light text-muted">Your life abroad, in one place.</p>
          </div>
        </div>

        <div className="card p-6 md:p-9">
          <div className="mb-7 flex gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1">
                <div className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-lavender")} />
                <p className={cn("mt-2 text-sm", i === step ? "font-medium text-primary" : "text-muted")}>{s}</p>
              </div>
            ))}
          </div>

          {step === 0 && (
            <>
              {app.needsOnboarding && <p className="mb-2 text-sm font-medium text-primary">Welcome{draft.name ? `, ${draft.name}` : ""}! Let's set up your account.</p>}
              <h1 className="text-3xl font-bold">Where are you studying?</h1>
              <p className="mt-2 font-light text-muted">Any city in the world. Your AI builds checklists, spots, apps and dates for it.</p>

              {draft.cityName && (
                <div className="mt-6 flex items-center gap-4 rounded-3xl border-2 border-primary bg-lavender-soft p-4">
                  <span className="text-4xl">{flagFor(draft.country ?? "")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold">{draft.cityName}</p>
                    <input
                      className="mt-1 w-full bg-transparent text-sm text-muted outline-none placeholder:text-muted/70"
                      placeholder="Country (e.g. Germany)"
                      value={draft.country ?? ""}
                      onChange={(e) => set({ country: e.target.value })}
                    />
                  </div>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white">
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                </div>
              )}

              <div className="relative mt-5">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  className="input pl-11"
                  placeholder="Search or type a city, e.g. Hanoi, Vietnam"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && typed) {
                      e.preventDefault();
                      const hit = matches[0];
                      if (hit && hit.name.toLowerCase() === typed.name.toLowerCase()) pickCity(hit.name, hit.country);
                      else pickCity(typed.name, typed.country);
                    }
                  }}
                />
              </div>
              {typed && !matches.some((m) => m.name.toLowerCase() === typed.name.toLowerCase()) && (
                <button className="pill mt-3 bg-white" onClick={() => pickCity(typed.name, typed.country)}>
                  <MapPin className="h-4 w-4" /> Use “{typed.name}{typed.country ? `, ${typed.country}` : ""}”
                </button>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {matches.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => pickCity(c.name, c.country)}
                    className={cn("pill", draft.cityName?.toLowerCase() === c.name.toLowerCase() && "pill-active")}
                  >
                    <span>{c.flag}</span> {c.name}
                  </button>
                ))}
              </div>
              {draft.cityName && !draft.country?.trim() && <p className="mt-3 text-sm text-cat-exam">Add the country so the AI gets the rules right.</p>}
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-bold">Your stay in {draft.cityName}</h1>
              <p className="mt-2 font-light text-muted">Your dates build the semester timeline and calendar deadlines.</p>
              <p className="mb-2 mt-6 text-sm font-medium">University</p>
              {universities.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {universities.map((u) => (
                    <button
                      key={u}
                      className={cn("pill", !customUni && draft.university === u && "pill-active")}
                      onClick={() => {
                        setCustomUni(false);
                        set({ university: u });
                      }}
                    >
                      {u}
                    </button>
                  ))}
                  <button className={cn("pill", customUni && "pill-active")} onClick={() => { setCustomUni(true); set({ university: "" }); }}>
                    Other…
                  </button>
                </div>
              )}
              {(customUni || universities.length === 0) && (
                <input className="input" placeholder="Your university or school" value={draft.university} onChange={(e) => set({ university: e.target.value })} />
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Arrival</span>
                  <input type="date" className="input" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Departure</span>
                  <input type="date" className="input" value={draft.end} min={draft.start} onChange={(e) => set({ end: e.target.value })} />
                </label>
              </div>
              <p className="mb-2 mt-6 text-sm font-medium">Program</p>
              <div className="flex flex-wrap gap-2">
                {PROGRAMS.map((p) => (
                  <button key={p} className={cn("pill", draft.program === p && "pill-active")} onClick={() => set({ program: draft.program === p ? undefined : p })}>
                    {p}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-bold">A bit about you</h1>
              <p className="mt-2 font-light text-muted">The more you tell us, the more personal your plan gets.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-sm font-medium">First name</span>
                  <input className="input" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Nationality (passport)</span>
                  <input className="input" list="home-countries" placeholder="e.g. Vietnam" value={draft.homeCountry ?? ""} onChange={(e) => set({ homeCountry: e.target.value })} />
                  <datalist id="home-countries">
                    {HOME_COUNTRIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>
              </div>
              <p className="mb-2 mt-6 text-sm font-medium">
                Interests <span className="font-light text-muted">· pick as many as you like</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {interests.map((i) => (
                  <button key={i} className={cn("pill", draft.interests.includes(i) && "pill-active")} onClick={() => toggleInterest(i)}>
                    {i}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Add your own, e.g. Badminton, K-pop, Bouldering"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomInterest();
                    }
                  }}
                />
                <button className="btn-outline shrink-0" disabled={!customInterest.trim()} onClick={addCustomInterest}>
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
              <label className="mt-6 block">
                <span className="mb-1.5 block text-sm font-medium">
                  Anything else? <span className="font-light text-muted">· optional</span>
                </span>
                <textarea
                  className="input min-h-[88px] resize-y py-3"
                  maxLength={600}
                  placeholder="e.g. First time in Europe, tight budget, need halal food, looking for a room near campus, I speak a bit of German…"
                  value={draft.about ?? ""}
                  onChange={(e) => set({ about: e.target.value })}
                />
              </label>
            </>
          )}

          <div className="mt-9 flex items-center justify-between">
            {step === 0 && app.needsOnboarding ? (
              <span />
            ) : (
              <button className="btn-outline" onClick={() => (step === 0 ? navigate(-1) : setStep(step - 1))}>
                <ArrowLeft className="h-4 w-4" /> {step === 0 ? "Cancel" : "Back"}
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button className="btn-primary" disabled={!canNext || saving} onClick={() => void personalize()}>
                {live ? (
                  <>
                    <Sparkles className="h-4 w-4" /> Personalize with AI
                  </>
                ) : saving ? (
                  "Saving…"
                ) : (
                  <>
                    Finish setup <Check className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonalizingScreen({
  draft,
  error,
  saving,
  onRetry,
  onSkip,
  onBack,
}: {
  draft: Profile;
  error: string;
  saving: boolean;
  onRetry: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const steps = LOADING_STEPS(draft);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (error) return;
    setI(0);
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 4500);
    return () => window.clearInterval(t);
  }, [error, steps.length]);

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-10">
      <div className="card w-full max-w-lg bg-lavender-soft p-8 text-center md:p-10">
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          {!error && <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />}
          <span className={cn("relative grid h-20 w-20 place-items-center rounded-full text-white", error ? "bg-cat-exam" : "bg-primary")}>
            {error ? <X className="h-9 w-9" /> : <Sparkles className="h-9 w-9" />}
          </span>
        </div>
        <h1 className="mt-6 text-3xl font-bold">{error ? "Something went wrong" : "AI is personalizing your Abroad"}</h1>
        <p className="mt-2 font-light text-muted">
          {error ? error : `${flagFor(draft.country ?? "")} ${draft.cityName} · ${draft.university}. This takes about 30–60 seconds.`}
        </p>

        {!error && (
          <ul className="mx-auto mt-7 max-w-sm space-y-3 text-left">
            {steps.map((s, n) => (
              <li key={s} className={cn("flex items-center gap-3 transition-opacity", n > i && "opacity-35")}>
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full",
                    n < i ? "bg-primary text-white" : n === i ? "bg-white text-primary" : "bg-white text-muted",
                  )}
                >
                  {n < i ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                </span>
                <span className={cn("text-[15px]", n === i && "font-medium")}>{s}</span>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button className="btn-primary" disabled={saving} onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> Try again
            </button>
            <button className="btn-outline bg-white" disabled={saving} onClick={onSkip}>
              {saving ? "Saving…" : "Continue without AI"}
            </button>
          </div>
        )}
        {error && (
          <button className="mt-4 text-sm text-muted underline underline-offset-2" onClick={onBack}>
            Back to edit my answers
          </button>
        )}
      </div>
    </div>
  );
}
