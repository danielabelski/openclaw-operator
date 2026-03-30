// Stylized claw/lobster geometry for brand integration
// Used as watermark, emblem accent, and panel decoration

interface ClawMarkProps {
  size?: number;
  className?: string;
}

export function ClawMark({ size = 32, className }: ClawMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
    >
      {/* Stylized claw / pincer shape */}
      <path d="M24 4C20 4 16 8 14 14C12 8 8 6 6 8C4 10 6 16 10 20C6 22 4 26 6 28C8 30 12 28 16 24C14 30 16 36 20 40C22 42 24 44 24 44C24 44 26 42 28 40C32 36 34 30 32 24C36 28 40 30 42 28C44 26 42 22 38 20C42 16 44 10 42 8C40 6 36 8 34 14C32 8 28 4 24 4Z" />
      {/* Center body dot */}
      <circle cx="24" cy="22" r="3" />
    </svg>
  );
}

// Small inline claw icon for badges/headers
export function ClawIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
    >
      <path d="M24 8C21 8 18 11 16 16C14 11 11 9 9 11C7 13 9 18 13 22C9 24 7 27 9 29C11 31 15 29 19 25C17 30 19 35 22 38C23 39 24 40 24 40C24 40 25 39 26 38C29 35 31 30 29 25C33 29 37 31 39 29C41 27 39 24 35 22C39 18 41 13 39 11C37 9 34 11 32 16C30 11 27 8 24 8Z" />
    </svg>
  );
}
