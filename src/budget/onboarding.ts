export const ONBOARDING_KEY = "butcemasyon_onboarding_seen_v1";

export const getGuestRoute = (hasSeenOnboarding: boolean) =>
  hasSeenOnboarding ? "/auth" : "/welcome";
