// Glossy 3D lobster emblem SVG for OpenClaw brand mark
// Designed to look like a machined metal badge mounted on the console header

interface LobsterEmblemProps {
  size?: number;
  className?: string;
}

export function LobsterEmblem({ size = 64, className }: LobsterEmblemProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        filter: 'drop-shadow(0 4px 12px hsl(0 70% 30% / 0.4)) drop-shadow(0 2px 4px hsl(0 0% 0% / 0.5))',
      }}
    >
      {/* Background plate */}
      <circle cx="60" cy="60" r="56" fill="hsl(216, 14%, 10%)" stroke="hsl(216, 10%, 18%)" strokeWidth="2" />
      <circle cx="60" cy="60" r="52" fill="hsl(216, 16%, 8%)" stroke="hsl(216, 10%, 14%)" strokeWidth="1" />

      {/* Body - main carapace */}
      <ellipse cx="60" cy="62" rx="18" ry="24" fill="url(#lobster-body)" />
      <ellipse cx="60" cy="62" rx="18" ry="24" fill="url(#lobster-gloss)" />

      {/* Head */}
      <ellipse cx="60" cy="42" rx="14" ry="10" fill="url(#lobster-body)" />
      <ellipse cx="60" cy="42" rx="14" ry="10" fill="url(#lobster-highlight)" />

      {/* Eyes */}
      <circle cx="52" cy="36" r="3" fill="hsl(0, 0%, 8%)" />
      <circle cx="68" cy="36" r="3" fill="hsl(0, 0%, 8%)" />
      <circle cx="51.5" cy="35" r="1.2" fill="hsl(0, 0%, 70%)" />
      <circle cx="67.5" cy="35" r="1.2" fill="hsl(0, 0%, 70%)" />

      {/* Antennae */}
      <path d="M52 34 Q42 20 32 14" stroke="hsl(4, 75%, 42%)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M68 34 Q78 20 88 14" stroke="hsl(4, 75%, 42%)" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M50 36 Q38 28 28 26" stroke="hsl(4, 75%, 42%)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M70 36 Q82 28 92 26" stroke="hsl(4, 75%, 42%)" strokeWidth="1.5" strokeLinecap="round" fill="none" />

      {/* Left claw arm */}
      <path d="M44 50 Q32 46 24 42" stroke="url(#lobster-body)" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Left claw pincer */}
      <path d="M24 42 Q18 36 14 30" stroke="hsl(2, 80%, 38%)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M24 42 Q20 48 16 44" stroke="hsl(2, 80%, 38%)" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Left claw fill */}
      <path d="M26 44 Q20 38 16 32 Q18 36 14 30 L16 32 Q19 40 18 44 Q20 48 16 44 L18 44 Q22 46 26 44Z"
            fill="hsl(4, 78%, 36%)" />
      <ellipse cx="22" cy="40" rx="6" ry="8" fill="url(#lobster-body)" transform="rotate(-15 22 40)" />
      <ellipse cx="22" cy="40" rx="6" ry="8" fill="url(#lobster-gloss)" transform="rotate(-15 22 40)" />

      {/* Right claw arm */}
      <path d="M76 50 Q88 46 96 42" stroke="url(#lobster-body)" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* Right claw pincer */}
      <path d="M96 42 Q102 36 106 30" stroke="hsl(2, 80%, 38%)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M96 42 Q100 48 104 44" stroke="hsl(2, 80%, 38%)" strokeWidth="4" strokeLinecap="round" fill="none" />
      {/* Right claw fill */}
      <ellipse cx="98" cy="40" rx="6" ry="8" fill="url(#lobster-body)" transform="rotate(15 98 40)" />
      <ellipse cx="98" cy="40" rx="6" ry="8" fill="url(#lobster-gloss)" transform="rotate(15 98 40)" />

      {/* Tail segments */}
      <ellipse cx="60" cy="76" rx="16" ry="6" fill="hsl(2, 75%, 35%)" />
      <ellipse cx="60" cy="82" rx="14" ry="5" fill="hsl(2, 72%, 32%)" />
      <ellipse cx="60" cy="87" rx="12" ry="4" fill="hsl(2, 70%, 30%)" />
      <ellipse cx="60" cy="91" rx="10" ry="3.5" fill="hsl(2, 68%, 28%)" />

      {/* Tail fan */}
      <path d="M50 94 Q48 102 44 106 Q52 100 60 102 Q68 100 76 106 Q72 102 70 94Z"
            fill="hsl(2, 72%, 32%)" />
      <path d="M50 94 Q48 102 44 106" stroke="hsl(2, 60%, 25%)" strokeWidth="1" fill="none" />
      <path d="M70 94 Q72 102 76 106" stroke="hsl(2, 60%, 25%)" strokeWidth="1" fill="none" />

      {/* Legs */}
      {[48, 52, 56].map((y, i) => (
        <g key={`legs-${i}`}>
          <line x1="44" y1={y} x2={32 - i * 2} y2={y + 6 + i * 2} stroke="hsl(4, 72%, 38%)" strokeWidth="2" strokeLinecap="round" />
          <line x1="76" y1={y} x2={88 + i * 2} y2={y + 6 + i * 2} stroke="hsl(4, 72%, 38%)" strokeWidth="2" strokeLinecap="round" />
        </g>
      ))}

      {/* Body segments / texture lines */}
      <line x1="48" y1="52" x2="72" y2="52" stroke="hsl(0, 60%, 28%)" strokeWidth="0.5" opacity="0.6" />
      <line x1="46" y1="58" x2="74" y2="58" stroke="hsl(0, 60%, 28%)" strokeWidth="0.5" opacity="0.6" />
      <line x1="45" y1="64" x2="75" y2="64" stroke="hsl(0, 60%, 28%)" strokeWidth="0.5" opacity="0.6" />
      <line x1="46" y1="70" x2="74" y2="70" stroke="hsl(0, 60%, 28%)" strokeWidth="0.5" opacity="0.6" />

      {/* Gloss overlay */}
      <ellipse cx="55" cy="48" rx="8" ry="16" fill="hsl(15, 90%, 70%)" opacity="0.12" transform="rotate(-10 55 48)" />
    </svg>
  );
}

// Small inline lobster icon for use in nav or badges
export function LobsterIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Simplified claw icon */}
      <path
        d="M12 4 Q8 2 5 4 Q3 6 4 9 L7 8 M12 4 Q16 2 19 4 Q21 6 20 9 L17 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <ellipse cx="12" cy="12" rx="5" ry="7" fill="currentColor" opacity="0.8" />
      <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor" opacity="0.6" />
      <path d="M9 20 L7 22 M15 20 L17 22 M12 20 L12 22" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
