export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <circle cx="20" cy="50" r="7" />
      <circle cx="44" cy="50" r="7" />
      <path d="M25 45 44 8M39 45 20 8" />
      <path d="M50 6v24M50 10h6M50 15h6M50 20h6M50 25h6" strokeWidth="2.5" />
    </svg>
  );
}
