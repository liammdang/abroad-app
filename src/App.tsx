import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CalendarPage from "./pages/Calendar";
import LifeAdmin from "./pages/LifeAdmin";
import Explore from "./pages/Explore";
import Settings from "./pages/Settings";
import Onboarding from "./pages/Onboarding";
import Assistant from "./pages/Assistant";
import { useApp } from "./state/AppState";

export default function App() {
  const { authReady, needsOnboarding } = useApp();
  const { pathname } = useLocation();

  if (!authReady) {
    return (
      <div className="grid min-h-full place-items-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-primary" />
      </div>
    );
  }
  // first sign-in: set up the profile before anything else
  if (needsOnboarding && pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;

  return (
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/life-admin" element={<LifeAdmin />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/assistant" element={<Assistant />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
