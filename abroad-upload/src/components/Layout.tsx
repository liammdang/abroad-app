import { CalendarDays, ClipboardCheck, Compass, Globe2, Home, MapPin, Settings, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useApp } from "@/state/AppState";
import { onToast } from "@/lib/toast";
import { cn } from "./ui";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/life-admin", label: "Life Admin", icon: ClipboardCheck },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Logo() {
  return (
    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-white">
      <Globe2 className="h-6 w-6" strokeWidth={1.8} />
    </span>
  );
}

export default function Layout() {
  const { city, profile } = useApp();
  const { pathname } = useLocation();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(
    () =>
      onToast((m) => {
        setMsg(m);
        window.setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 2600);
      }),
    [],
  );

  return (
    <div className="min-h-full">
      {/* Desktop / tablet sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col border-r border-line bg-white px-6 pb-6 pt-7 md:flex">
        <Link to="/" className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-2xl font-bold text-ink">Abroad</span>
        </Link>
        <p className="mt-2 text-sm font-light text-muted">Your life abroad, in one place.</p>

        <nav className="mt-10 flex flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-full px-4 py-3 text-[16px] transition",
                  isActive ? "bg-primary text-white" : "text-ink/75 hover:bg-sand",
                )
              }
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-3xl border border-line bg-lavender-soft p-4">
          <div className="flex items-center gap-2 text-[16px] font-medium text-ink">
            <MapPin className="h-4 w-4" strokeWidth={1.8} />
            <span>{city.flag}</span>
            {city.name}
          </div>
          <p className="mt-1 text-sm font-light text-muted">{profile.university}</p>
          <Link to="/onboarding" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Change destination <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="scale-75"><Logo /></span>
          <span className="font-display text-xl font-bold">Abroad</span>
        </Link>
        <Link to="/onboarding" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm">
          {city.flag} {city.name}
        </Link>
      </header>

      <main className="px-4 pb-28 pt-6 md:ml-[272px] md:px-8 md:pb-12 md:pt-12 lg:px-10">
        <div className="mx-auto max-w-[1280px]">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive ? "text-primary font-semibold" : "text-muted")
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {msg && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-white shadow-lg md:bottom-8">
          {msg}
        </div>
      )}
    </div>
  );
}
