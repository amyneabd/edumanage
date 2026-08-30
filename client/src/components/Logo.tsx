export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#102A56" />
      <rect x="8" y="17" width="4" height="7" rx="1.5" fill="#F4F8FC" />
      <rect x="14" y="12" width="4" height="12" rx="1.5" fill="#2563EB" />
      <rect x="20" y="7" width="4" height="17" rx="1.5" fill="#20B26B" />
    </svg>
  );
}
