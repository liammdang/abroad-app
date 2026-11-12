import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Layout";
import { cn } from "@/components/ui";
import { CITIES, CITY_LIST, INTERESTS } from "@/data/cities";
import type { CityId } from "@/data/types";
import { toast } from "@/lib/toast";
import { useApp, type Profile } from "@/state/AppState";

const STEPS = ["Destination", "Your stay", "About you"];

export default function Onboarding() {
  const app = useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>(app.profile);
  const [customUni, setCustomUni] = useState(!CITIES[app.profile.cityId].universities.includes(app.profile.university));

  const city = CITIES[draft.cityId];
  const pickCity = (id: CityId) => {
    setDraft((d) => ({ ...d, cityId: id, university: id === d.cityId ? d.university : CITIES[id].universities[0] }));
    if (id !== draft.cityId) setCustomUni(false);
  };

  const canNext =
    step === 0 ||
    (step === 1 && draft.university.trim() && draft.start && draft.end && draft.end >= draft.start) ||
    (step === 2 && draft.name.trim());

  const [saving, setSaving] = useState(false);
  const finish = async () => {
    setSaving(true);
    try {
      await app.setProfile({ ...draft, name: draft.name.trim(), university: draft.university.trim() });
      navigate("/");
      window.setTimeout(() => toast(`All set for ${city.name}!`), 50);
    } catch {
      setSaving(false);
    }
  };

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
              <p className="mt-2 font-light text-muted">Checklists, local spots and events adapt to your city.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {CITY_LIST.map((c) => {
                  const active = c.id === draft.cityId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => pickCity(c.id)}
                      className={cn(
                        "relative rounded-3xl border-2 p-5 text-left transition",
                        active ? "border-primary bg-lavender-soft" : "border-line hover:border-primary/30",
                      )}
                    >
                      {active && (
                        <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                      <span className="text-4xl">{c.flag}</span>
                      <p className="mt-3 text-xl font-bold">{c.name}</p>
                      <p className="text-sm text-muted">{c.country}</p>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-3xl font-bold">Your stay in {city.name}</h1>
              <p className="mt-2 font-light text-muted">We use your dates to build your semester timeline.</p>
              <p className="mb-2 mt-6 text-sm font-medium">University</p>
              <div className="flex flex-wrap gap-2">
                {city.universities.map((u) => (
                  <button
                    key={u}
                    className={cn("pill", !customUni && draft.university === u && "pill-active")}
                    onClick={() => {
                      setCustomUni(false);
                      setDraft((d) => ({ ...d, university: u }));
                    }}
                  >
                    {u}
                  </button>
                ))}
                <button className={cn("pill", customUni && "pill-active")} onClick={() => { setCustomUni(true); setDraft((d) => ({ ...d, university: "" })); }}>
                  Other…
                </button>
              </div>
              {customUni && (
                <input
                  className="input mt-3"
                  placeholder="Your university"
                  value={draft.university}
                  onChange={(e) => setDraft((d) => ({ ...d, university: e.target.value }))}
                  autoFocus
                />
              )}
              <div className="mt-6 grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Arrival</span>
                  <input type="date" className="input" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium">Departure</span>
                  <input type="date" className="input" value={draft.end} min={draft.start} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-bold">A bit about you</h1>
              <p className="mt-2 font-light text-muted">We'll suggest spots and meetups that match your interests.</p>
              <label className="mt-6 block">
                <span className="mb-1.5 block text-sm font-medium">First name</span>
                <input className="input" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
              </label>
              <p className="mb-2 mt-6 text-sm font-medium">Interests</p>
              <div className="flex flex-wrap gap-2">
                {INTERESTS.map((i) => {
                  const on = draft.interests.includes(i);
                  return (
                    <button
                      key={i}
                      className={cn("pill", on && "pill-active")}
                      onClick={() =>
                        setDraft((d) => ({ ...d, interests: on ? d.interests.filter((x) => x !== i) : [...d.interests, i] }))
                      }
                    >
                      {i}
                    </button>
                  );
                })}
              </div>
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
              <button className="btn-primary" disabled={!canNext || saving} onClick={() => void finish()}>
                {saving ? "Saving…" : "Finish setup"} <Check className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
