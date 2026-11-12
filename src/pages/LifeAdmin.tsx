import { Check, ChevronDown, Download, FileText, Lightbulb, MapPin } from "lucide-react";
import { useState } from "react";
import { PageHeader, ProgressBar, cn } from "@/components/ui";
import { mapsUrl } from "@/data/cities";
import type { PhaseId, Task } from "@/data/types";
import { currentPhase } from "@/lib/date";
import { downloadChecklist } from "@/lib/pdf";
import { toast } from "@/lib/toast";
import { useApp } from "@/state/AppState";

export default function LifeAdmin() {
  const { city, isDone, today, profile } = useApp();
  // open the phase that fits where you are in your stay
  const [phaseId, setPhaseId] = useState<PhaseId>(() => currentPhase(today, profile.start, profile.end));
  const [open, setOpen] = useState<string | null>(null);

  const all = city.phases.flatMap((p) => p.items);
  const doneCount = all.filter((t) => isDone(t.id)).length;
  const phase = city.phases.find((p) => p.id === phaseId)!;

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span>{city.flag}</span> {city.name}
          </>
        }
        title="Life Admin"
        right={
          <div className="w-full sm:w-[300px]">
            <div className="mb-2 flex justify-between text-[16px]">
              <span className="font-light text-muted">Overall</span>
              <span className="font-medium">
                {doneCount}/{all.length}
              </span>
            </div>
            <ProgressBar value={doneCount / all.length} />
          </div>
        }
      />

      <div className="-mx-4 mb-6 flex gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {city.phases.map((p) => {
          const d = p.items.filter((t) => isDone(t.id)).length;
          const active = p.id === phaseId;
          return (
            <button
              key={p.id}
              onClick={() => {
                setPhaseId(p.id);
                setOpen(null);
              }}
              className={cn(
                "shrink-0 rounded-3xl border px-5 py-3 text-left transition",
                active ? "border-primary bg-primary text-white" : "border-line bg-white hover:border-primary/40",
              )}
            >
              <span className="block font-medium">{p.label}</span>
              <span className={cn("block text-sm font-light", active ? "text-white/80" : "text-muted")}>
                {d} of {p.items.length} done
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {phase.items.map((t) => (
          <TaskCard key={t.id} task={t} open={open === t.id} onToggleOpen={() => setOpen(open === t.id ? null : t.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task, open, onToggleOpen }: { task: Task; open: boolean; onToggleOpen: () => void }) {
  const { isDone, toggleTask, city, integrations, profile } = useApp();
  const done = isDone(task.id);
  const allTasks = city.phases.flatMap((p) => p.items);
  const blockers = (task.dependsOn ?? []).filter((id) => !isDone(id)).map((id) => allTasks.find((t) => t.id === id)!);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-5">
        <button
          onClick={() => {
            void toggleTask(task.id).then(() => {
              if (!done) toast(`Nice! "${task.title}" done`);
            });
          }}
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 transition",
            done ? "border-success bg-success text-white" : "border-line hover:border-primary/50",
          )}
        >
          {done && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>
        <button onClick={onToggleOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="min-w-0 flex-1">
            <p className={cn("text-lg font-medium text-ink", done && "line-through decoration-ink/60")}>{task.title}</p>
            <p className="text-[16px] font-light text-muted">{task.summary}</p>
            {!done && blockers.length > 0 && (
              <p className="mt-1.5 inline-flex rounded-full bg-lavender px-2.5 py-0.5 text-[13px] text-primary">
                Needs first: {blockers.map((b) => b.title.split(" (")[0]).join(", ")}
              </p>
            )}
          </div>
          <ChevronDown className={cn("h-5 w-5 shrink-0 text-ink/60 transition", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="grid gap-4 border-t border-line bg-canvas/60 px-5 py-5 md:grid-cols-2 md:pl-[4.25rem]">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <FileText className="h-4 w-4 text-primary" /> What you'll need
            </h3>
            <ul className="space-y-1.5">
              {task.documents.map((d) => (
                <li key={d} className="flex items-start gap-2 text-[15px] text-ink/85">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" /> {d}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div className="rounded-3xl bg-lavender-soft p-4">
              <h3 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
                <Lightbulb className="h-4 w-4 text-star" /> Insider tip
              </h3>
              <p className="text-[15px] font-light text-ink/85">{task.tip}</p>
            </div>
            <button
              onClick={() =>
                void downloadChecklist(task, city.name, profile.name).catch(() => toast("Could not create the PDF"))
              }
              className="btn-primary mr-2 py-2 text-sm"
            >
              <Download className="h-4 w-4" /> Download checklist (PDF)
            </button>
            {task.mapsQuery && (
              <a
                href={mapsUrl(task.mapsQuery, city.name)}
                target="_blank"
                rel="noreferrer"
                className="btn-outline py-2 text-sm"
                onClick={(e) => {
                  if (!integrations.googleMaps) {
                    e.preventDefault();
                    toast("Turn on Google Maps in Settings to open directions");
                  }
                }}
              >
                <MapPin className="h-4 w-4" /> Open in Google Maps
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
