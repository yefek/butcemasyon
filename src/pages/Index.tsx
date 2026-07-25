import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import IndexV2 from "./IndexV2";
import { useAuth } from "@/budget/useAuth";
import { getGuestRoute, ONBOARDING_KEY } from "@/budget/onboarding";

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate(getGuestRoute(localStorage.getItem(ONBOARDING_KEY) === "1"), { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return <div className="v2-root min-h-screen flex items-center justify-center v2-text-muted">Yükleniyor…</div>;
  }
  if (!user) return null;
  return <IndexV2 />;
}
