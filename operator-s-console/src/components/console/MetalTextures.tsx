// SVG filter definitions for brushed metal noise & emboss effects

export function MetalTextureDefs() {
  return (
    <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
      <defs>
        {/* Brushed metal noise */}
        <filter id="metal-noise" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feComponentTransfer in="gray" result="faint">
            <feFuncA type="linear" slope="0.1" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="faint" mode="overlay" />
        </filter>

        {/* Fine grain texture */}
        <filter id="grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="3" stitchTiles="stitch" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="gray" />
          <feComponentTransfer in="gray" result="faint">
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="faint" mode="overlay" />
        </filter>

        {/* Emboss effect for bolts */}
        <filter id="emboss" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur" />
          <feSpecularLighting in="blur" surfaceScale="3" specularConstant="0.6" specularExponent="20" result="spec">
            <fePointLight x="-5000" y="-5000" z="8000" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specOut" />
          <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>

        {/* Brushed metal pattern */}
        <filter id="brushed-metal-filter" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.8" numOctaves="2" seed="5" stitchTiles="stitch" result="brushNoise" />
          <feColorMatrix type="saturate" values="0" in="brushNoise" result="brushGray" />
          <feComponentTransfer in="brushGray" result="brushFaint">
            <feFuncA type="linear" slope="0.06" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="brushFaint" mode="overlay" />
        </filter>

        {/* Metallic gradient for lobster emblem */}
        <linearGradient id="lobster-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(8, 85%, 48%)" />
          <stop offset="35%" stopColor="hsl(2, 80%, 40%)" />
          <stop offset="70%" stopColor="hsl(0, 75%, 32%)" />
          <stop offset="100%" stopColor="hsl(0, 70%, 22%)" />
        </linearGradient>

        <linearGradient id="lobster-highlight" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="hsl(12, 90%, 62%)" stopOpacity="0.9" />
          <stop offset="50%" stopColor="hsl(6, 85%, 50%)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>

        <radialGradient id="lobster-gloss" cx="0.4" cy="0.3" r="0.6">
          <stop offset="0%" stopColor="hsl(15, 90%, 70%)" stopOpacity="0.5" />
          <stop offset="60%" stopColor="transparent" />
        </radialGradient>

        <linearGradient id="frame-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(216, 10%, 22%)" />
          <stop offset="50%" stopColor="hsl(216, 12%, 16%)" />
          <stop offset="100%" stopColor="hsl(216, 14%, 10%)" />
        </linearGradient>

        <filter id="indicator-glow">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}

// Full-page noise overlay for brushed metal texture — increased visibility
export function NoiseOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] opacity-[0.12]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '512px 512px',
        mixBlendMode: 'overlay',
      }}
    />
  );
}

// Inline brushed metal texture overlay for specific elements
export function BrushedMetalOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] opacity-[0.12]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='b'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.015 0.7' numOctaves='3' seed='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23b)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '400px 400px',
        mixBlendMode: 'overlay',
      }}
    />
  );
}
