export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const padded = `${minutes.toString().padStart(hours ? 2 : 1, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
  return hours ? `${hours}:${padded}` : padded;
}

export function formatBytes(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(2)} غ.ب` : `${Math.round(bytes / 1024 ** 2)} م.ب`;
}

/** `S1 · E3` style label for the top bar and the episode list. */
export function formatEpisodeCode(seasonPosition: number | null, episodeNumber: number) {
  const episode = `الحلقة ${episodeNumber}`;
  return seasonPosition === null ? episode : `الموسم ${seasonPosition} · ${episode}`;
}
