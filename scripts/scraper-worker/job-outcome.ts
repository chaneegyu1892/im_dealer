export type JobOutcome = "completed" | "canceled" | "failed";

export function shouldApplyJobCooldown(outcome: JobOutcome): boolean {
  return outcome === "completed";
}
