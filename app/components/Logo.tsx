export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5 4 5.2v6.1c0 4.6 3.2 8.2 8 10.2 4.8-2 8-5.6 8-10.2V5.2L12 2.5Z"
        stroke="var(--rb-red)"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="white"
      />
      <path d="M12 5v14" stroke="var(--rb-red)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight" style={{ fontSize: size * 0.62 }}>
      <Logo size={size} />
      <span>Red Batch</span>
    </span>
  );
}
