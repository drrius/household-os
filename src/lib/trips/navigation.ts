export function bookingBack(projectId: string, candidate?: string) {
  const base = `/plan/projects/${projectId}`;
  if (!candidate) return `${base}#itinerary`;
  try {
    const url = new URL(candidate, "https://household.invalid");
    if (url.origin !== "https://household.invalid" || url.pathname !== base)
      return `${base}#itinerary`;
    const query = new URLSearchParams();
    for (const key of ["bookingPage", "taskPage"]) {
      const value = url.searchParams.get(key);
      if (value && /^\d{1,6}$/.test(value)) query.set(key, value);
    }
    for (const key of ["archivedBookings", "archivedTasks"])
      if (url.searchParams.get(key) === "1") query.set(key, "1");
    return `${base}${query.size ? `?${query}` : ""}#itinerary`;
  } catch {
    return `${base}#itinerary`;
  }
}
