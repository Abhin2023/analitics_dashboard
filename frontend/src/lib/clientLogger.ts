/**
 * Forwards uncaught browser errors to the backend so they land in
 * logs/frontend.log — otherwise the only record is devtools console output,
 * which is gone the moment the tab closes or reloads.
 */
let sentCount = 0;
const MAX_LOGS_PER_SESSION = 200; // guard against a tight error loop flooding the log file

function send(level: "error" | "warning", message: string, stack = "") {
  if (sentCount >= MAX_LOGS_PER_SESSION) return;
  sentCount++;
  try {
    fetch("/api/v1/client-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level,
        message: String(message).slice(0, 2000),
        stack: String(stack).slice(0, 4000),
        url: window.location.href,
        user_agent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // never let logging itself throw
  }
}

export function initClientLogger() {
  window.addEventListener("error", (event) => {
    send("error", event.message, event.error?.stack || "");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason);
    send("error", `Unhandled promise rejection: ${message}`, reason?.stack || "");
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    send("error", args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  };
}
