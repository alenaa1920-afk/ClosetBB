/**
 * Hands the signed-in session to the extension.
 *
 * Why this file exists: the Supabase auth cookie is `SameSite=Lax`, which means
 * the browser will *not* attach it to a fetch started by the extension's
 * service worker — that counts as cross-site. So the worker asking
 * `/api/extension/session` directly always got a 401, and the popup's Save
 * button stayed disabled with everything else working perfectly.
 *
 * A content script runs inside the page, so its fetch is same-origin and the
 * cookie rides along normally. It reads the session here and passes it to the
 * worker, which stores the refresh token and can renew itself from then on —
 * including when no Mon Amour tab is open at all.
 */

(function () {
  "use strict";

  async function handOver() {
    try {
      const response = await fetch("/api/extension/session", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) return;

      const session = await response.json();
      if (!session?.accessToken) return;

      chrome.runtime.sendMessage({ type: "SESSION", session }, () => {
        // The worker may be asleep or the extension reloading; not an error.
        void chrome.runtime.lastError;
      });
    } catch {
      // Offline, or signed out. Nothing to hand over.
    }
  }

  void handOver();

  // Signing in or out does not reload the page, so refresh on return to it.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void handOver();
  });
})();
