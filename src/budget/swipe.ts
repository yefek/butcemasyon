const REVEAL_THRESHOLD = 30;
const COMMIT_THRESHOLD = 112;

export type SwipeOutcome = "edit" | "delete" | "reveal-edit" | "reveal-delete" | "close";

export function getSwipeOutcome(offset: number): SwipeOutcome {
  if (offset >= COMMIT_THRESHOLD) return "edit";
  if (offset <= -COMMIT_THRESHOLD) return "delete";
  if (offset >= REVEAL_THRESHOLD) return "reveal-edit";
  if (offset <= -REVEAL_THRESHOLD) return "reveal-delete";
  return "close";
}
