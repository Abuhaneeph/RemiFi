/** Returns a persistent session ID stored in localStorage. */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const key = "remifi_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
