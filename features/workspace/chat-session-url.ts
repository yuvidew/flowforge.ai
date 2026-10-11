// Name of the URL query parameter that holds the open chat session (`/workspace/<board>?session=<id>`).
const SESSION_PARAM = "session";

// The session id in the current URL, or null. Browser only (reads window), so call it from an effect or an event handler.
export const readSessionParam = () => new URLSearchParams(window.location.search).get(SESSION_PARAM);

// Puts the open session into the URL (or removes it for a new chat) without adding a history entry or reloading.
// Next.js syncs native history.replaceState calls with its router, and other query params and the hash are kept.
export const writeSessionParam = (sessionId: string | null) => {
  const url = new URL(window.location.href);

  if (sessionId) url.searchParams.set(SESSION_PARAM, sessionId);
  else url.searchParams.delete(SESSION_PARAM);

  window.history.replaceState(null, "", url);
};
