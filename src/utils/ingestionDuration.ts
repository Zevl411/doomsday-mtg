export interface IngestionJobTimestamps {
  startedAt?: string;
  completedAt?: string;
}

/** Returns wall-clock runtime, or null while a queued job has not started. */
export function getIngestionJobDurationMs(
  job: IngestionJobTimestamps,
  currentTime = Date.now(),
): number | null {
  if (!job.startedAt) return null;
  const startedAt = Date.parse(job.startedAt);
  const endedAt = job.completedAt ? Date.parse(job.completedAt) : currentTime;
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return null;
  return Math.max(0, endedAt - startedAt);
}

export function formatElapsedDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
