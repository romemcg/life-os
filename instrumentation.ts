// Runs once when the LIFE OS server starts. Starts the desktop task reminders (macOS only).
// The import must sit inside the NEXT_RUNTIME check so the edge bundle never pulls in SQLite.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const { startNotifier } = await import("./lib/notifier");
    startNotifier();
  }
}
