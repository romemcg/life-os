"use client";
import { useEffect, useRef } from "react";

/** Interactive dot grid (same motif as mark-gomez.vercel.app): dots bulge away from the cursor and link up like a circuit.
 *  Minimal version for the app: faint static dots that ripple gently around the cursor. Pauses when the tab is hidden. */
export function TechBackground() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const GAP = 34, R = 180;
    let w = 0, h = 0, raf = 0, rgb = "37 99 235", cols = 0;
    type Dot = { ox: number; oy: number; x: number; y: number };
    let dots: Dot[] = [];
    const m = { x: -9999, y: -9999, tx: -9999, ty: -9999 };
    const readColor = () => { rgb = getComputedStyle(document.documentElement).getPropertyValue("--teal-400").trim() || rgb; };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = []; cols = Math.ceil(w / GAP) + 1;
      for (let y = 0; y <= h + GAP; y += GAP) for (let x = 0; x <= w + GAP; x += GAP) dots.push({ ox: x, oy: y, x, y });
    };
    const draw = (_t: number) => {
      ctx.clearRect(0, 0, w, h);
      m.x += (m.tx - m.x) * 0.14; m.y += (m.ty - m.y) * 0.14;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const dx = d.ox - m.x, dy = d.oy - m.y, dist = Math.hypot(dx, dy) || 1;
        const k = Math.max(0, 1 - dist / R);
        const push = k * k * 18;
        d.x += (d.ox + (dx / dist) * push - d.x) * 0.18;
        d.y += (d.oy + (dy / dist) * push - d.y) * 0.18;
        ctx.fillStyle = `rgb(${rgb} / ${0.07 + k * 0.45})`;
        ctx.beginPath(); ctx.arc(d.x, d.y, 0.9 + k * 1.4, 0, 6.2832); ctx.fill();
      }
    };
    const loop = (t: number) => { if (!document.hidden) draw(t); raf = requestAnimationFrame(loop); };
    const move = (e: PointerEvent) => { if (e.pointerType !== "mouse") return; m.tx = e.clientX; m.ty = e.clientY; if (m.x < -999) { m.x = e.clientX; m.y = e.clientY; } };
    const leave = () => { m.tx = m.ty = m.x = m.y = -9999; };
    readColor(); resize();
    const mo = new MutationObserver(() => { readColor(); if (reduce) draw(0); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", resize);
    if (reduce) draw(0);
    else {
      window.addEventListener("pointermove", move);
      document.addEventListener("pointerleave", leave);
      raf = requestAnimationFrame(loop);
    }
    return () => {
      cancelAnimationFrame(raf); mo.disconnect();
      window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); document.removeEventListener("pointerleave", leave);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
