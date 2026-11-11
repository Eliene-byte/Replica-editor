/** Timecode em frames — compartilhado entre servidor e front. */
export function formatTimecode(frames: number, fps: number): string {
  const f = Math.max(0, Math.round(frames));
  const roundedFps = Math.max(1, Math.round(fps));
  const total = Math.floor(f / roundedFps);
  const framesPart = f % roundedFps;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(hh)}:${p(mm)}:${p(ss)}:${p(framesPart)}`;
}

export function formatDuration(frames: number, fps: number): string {
  const total = Math.max(0, Math.round(frames / Math.max(1, fps)));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}
