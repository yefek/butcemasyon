import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Welcome = lazy(() => import("./pages/Welcome.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

function RememberMeGuard() {
  useEffect(() => {
    const handler = () => {
      if (localStorage.getItem("butce_remember") === "0") {
        // best-effort sign out so user must re-login on next visit
        supabase.auth.signOut();
      }
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, []);
  return null;
}

const App = () => (
  <>
    <Sonner />
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <RememberMeGuard />
      <Suspense fallback={<div className="v2-root min-h-screen flex items-center justify-center v2-text-muted">Yükleniyor…</div>}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </>
);

export default App;
