import clsx from "clsx";

/** LIFE OS mark: small consistent steps rising to a destination (2035). */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} role="img" aria-label="LIFE OS logo">
      <rect width="32" height="32" rx="9" fill="#0b3a3e" />
      <path d="M7 24.5h4.5V20h4.5v-4.5h4.5V11" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="23.6" cy="7.6" r="2.7" fill="#f2c14e" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="font-display block text-[18px] font-semibold text-fog-100">Life OS</span>
        <span className="mt-1 block text-[11px] text-fog-500">Project 2035</span>
      </span>
    </span>
  );
}
