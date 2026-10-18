"use client";
import { useEffect } from "react";

/** Reloads the tab when a newer version of the app has been installed, so nobody looks at a stale screen. */
export function UpdateWatcher() {
  useEffect(() => {
    let first: string | null = null;
    async function check() {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { id } = (await r.json()) as { id: string };
        if (first === null) first = id;
        else if (id !== first) window.location.reload();
      } catch {}
    }
    check();
    const t = setInterval(check, 30000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, []);
  return null;
}
