// Mobile & tablet chassis frame — thick industrial housing with corner bolts,
// amber indicator lamps, signal analyzer, and bottom navigation/control bar
// Matches the handheld device reference image

import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Bolt, IndicatorLamp, MechanicalKnob, ToggleSwitch, PressureGauge } from "./IndustrialFrame";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCallback, useEffect, useRef, useState } from "react";

// Trigger device vibration if available
function triggerHaptic(duration = 10) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  } catch {}
}

const mobileNavItems = [
  { to: "/", label: "Overview" },
  { to: "/tasks", label: "Tasks" },
  { to: "/task-runs", label: "Runs" },
  { to: "/approvals", label: "Approve" },
  { to: "/incidents", label: "Incidents" },
  { to: "/agents", label: "Agents" },
  { to: "/governance", label: "Gov" },
  { to: "/knowledge", label: "Know" },
  { to: "/system-health", label: "Health" },
  { to: "/diagnostics", label: "Diag" },
  { to: "/public-proof", label: "Proof", special: true },
];

function RectLampMobile({ color = 'amber', glow = false }: { color?: 'amber' | 'green'; glow?: boolean }) {
  const colors = {
    amber: { core: 'hsl(30, 85%, 45%)', bright: 'hsl(35, 90%, 55%)', glowColor: 'hsl(35, 90%, 50%)' },
    green: { core: 'hsl(142, 60%, 35%)', bright: 'hsl(142, 65%, 45%)', glowColor: 'hsl(142, 65%, 40%)' },
  };
  const c = colors[color];
  return (
    <div className="relative" style={{ width: 10, height: 6 }}>
      <div className="absolute inset-0 rounded-[1px]" style={{
        background: 'hsl(216, 16%, 5%)',
        boxShadow: 'inset 0 1px 2px hsl(216, 18%, 3% / 0.8), 0 0 0 0.5px hsl(216, 10%, 10%)',
      }} />
      <div className={`absolute inset-[1px] rounded-[0.5px] ${glow ? 'animate-glow-breathe' : ''}`} style={{
        background: `linear-gradient(180deg, ${c.bright} 0%, ${c.core} 100%)`,
        boxShadow: glow
          ? `0 0 6px 2px ${c.glowColor}90, 0 0 14px 4px ${c.glowColor}40`
          : `0 0 3px 1px ${c.glowColor}50`,
      }} />
    </div>
  );
}

// Signal analyzer — animated waveform display, tap to freeze/unfreeze
function SignalAnalyzer({ width = 120, height = 28 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  const offsetRef = useRef(0);

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'hsl(216, 10%, 18%)';
      ctx.lineWidth = 0.5;
      for (let y = 0; y < height; y += height / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let x = 0; x < width; x += width / 8) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Signal waveform
      const waveColor = frozenRef.current ? 'hsl(0, 72%, 50%)' : 'hsl(38, 92%, 50%)';
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const t = (x / width) * Math.PI * 4 + offsetRef.current;
        const y = height / 2 +
          Math.sin(t) * (height * 0.25) +
          Math.sin(t * 2.3 + 1) * (height * 0.1) +
          Math.sin(t * 5.7 + 3) * (height * 0.05);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Frozen label
      if (frozenRef.current) {
        ctx.fillStyle = 'hsl(0, 72%, 55%)';
        ctx.font = `bold ${Math.max(8, height * 0.3)}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText('HOLD', width - 3, height * 0.35);
      }

      if (!frozenRef.current) {
        offsetRef.current += 0.03;
      }
      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [width, height]);

  return (
    <motion.div
      className="relative rounded-sm overflow-hidden cursor-pointer select-none"
      style={{
        width,
        height,
        background: 'hsl(216, 18%, 4%)',
        border: frozen ? '1.5px solid hsl(0, 72%, 35%)' : '1.5px solid hsl(216, 10%, 14%)',
        boxShadow: frozen
          ? `inset 0 2px 6px hsl(216, 20%, 2% / 0.9), 0 0 8px hsl(0, 72%, 48% / 0.2)`
          : `inset 0 2px 6px hsl(216, 20%, 2% / 0.9), inset 0 0 0 1px hsl(216, 12%, 8%), 0 1px 0 hsl(216, 8%, 18% / 0.3)`,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onClick={() => { triggerHaptic(15); setFrozen(f => !f); }}
      whileTap={{ scale: 0.96 }}
      aria-label={frozen ? "Unfreeze signal" : "Freeze signal"}
    >
      <canvas ref={canvasRef} width={width} height={height} className="block" />
    </motion.div>
  );
}

// Slider control — horizontal fader like mixing console
function SliderFader({ width = 80 }: { width?: number }) {
  const [value, setValue] = useState(65);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setValue(pct);
  };

  return (
    <div className="relative" style={{ width, height: 18 }}>
      {/* Track groove */}
      <div
        ref={trackRef}
        className="absolute top-1/2 -translate-y-1/2 rounded-full cursor-pointer"
        style={{
          left: 4, right: 4, height: 4,
          background: `linear-gradient(180deg, hsl(216, 16%, 6%) 0%, hsl(216, 14%, 10%) 100%)`,
          boxShadow: 'inset 0 1px 3px hsl(216, 18%, 3% / 0.8), 0 1px 0 hsl(216, 8%, 18% / 0.3)',
        }}
        onPointerDown={(e) => {
          handleMove(e.clientX);
          const onMove = (ev: PointerEvent) => handleMove(ev.clientX);
          const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        }}
      >
        {/* Fill */}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{
          width: `${value}%`,
          background: 'linear-gradient(90deg, hsl(38, 70%, 35%) 0%, hsl(38, 85%, 45%) 100%)',
          boxShadow: '0 0 6px hsl(38, 92%, 50% / 0.3)',
        }} />
      </div>
      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-sm cursor-grab active:cursor-grabbing"
        style={{
          left: `calc(${value}% * ${(width - 8) / width} + 4px - 6px)`,
          width: 12, height: 16,
          background: `linear-gradient(180deg, hsl(216, 8%, 32%) 0%, hsl(216, 10%, 22%) 50%, hsl(216, 8%, 28%) 100%)`,
          boxShadow: `
            inset 0 1px 0 hsl(216, 8%, 40% / 0.5),
            inset 0 -1px 0 hsl(216, 18%, 8% / 0.5),
            0 2px 4px hsl(216, 18%, 3% / 0.5)`,
          border: '1px solid hsl(216, 10%, 16%)',
        }}
      >
        {/* Grip lines */}
        <div className="absolute inset-x-[3px] top-[4px] flex flex-col gap-[2px]">
          {[0,1,2].map(i => (
            <div key={i} className="w-full" style={{ height: 1, background: 'hsl(216, 8%, 16%)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileBottomBar() {
  const location = useLocation();
  const isMobile = useIsMobile();

  const knobSize = isMobile ? 32 : 44;
  const knobSizeSm = isMobile ? 24 : 36;
  const analyzerW = isMobile ? 90 : 160;
  const analyzerH = isMobile ? 22 : 32;
  const sliderW = isMobile ? 60 : 100;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Hardware control strip above nav */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-1.5 sm:py-2.5 brushed-metal" style={{
        background: `linear-gradient(180deg, hsl(216, 12%, 13%) 0%, hsl(216, 14%, 10%) 100%)`,
        borderTop: '2px solid hsl(216, 10%, 16%)',
        boxShadow: 'inset 0 1px 0 hsl(216, 8%, 22% / 0.4), 0 -2px 8px hsl(216, 18%, 3% / 0.5)',
      }}>
        {/* Left controls — toggle + lamps */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ToggleSwitch on size="sm" />
          <div className="flex flex-col gap-0.5">
            <RectLampMobile color="amber" glow />
            <RectLampMobile color="green" />
          </div>
        </div>

        {/* Center — big dials + analyzer + slider */}
        <div className="flex items-center gap-2 sm:gap-4">
          <MechanicalKnob rotation={35} size={knobSize} variant="heavy" />
          <MechanicalKnob rotation={-60} size={knobSize} variant="standard" />

          {/* Signal analyzer */}
          <SignalAnalyzer width={analyzerW} height={analyzerH} />

          {!isMobile && (
            <MechanicalKnob rotation={15} size={knobSizeSm} variant="flush" />
          )}
        </div>

        {/* Right controls — slider + lamp */}
        <div className="flex items-center gap-2 sm:gap-3">
          <SliderFader width={sliderW} />
          <div className="flex flex-col gap-0.5">
            <RectLampMobile color="amber" />
            <RectLampMobile color="amber" glow />
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav className="flex items-stretch brushed-metal overflow-x-auto scrollbar-none" style={{
        background: `linear-gradient(180deg, hsl(216, 14%, 11%) 0%, hsl(216, 16%, 8%) 100%)`,
        borderTop: '1px solid hsl(216, 10%, 14%)',
        boxShadow: 'inset 0 1px 0 hsl(216, 8%, 18% / 0.3)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {mobileNavItems.map((item) => {
          const isSpecial = 'special' in item && item.special;
          const isActive = item.to === "/"
            ? location.pathname === "/"
            : location.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className="flex-1 relative min-w-[48px]"
              onClick={() => triggerHaptic(8)}
            >
              <motion.div
                className={cn(
                  "py-2.5 text-center transition-colors duration-150",
                  "text-[8px] sm:text-[10px] font-mono font-bold uppercase tracking-[0.08em]",
                  isSpecial
                    ? (isActive ? "text-status-info" : "text-status-info/60")
                    : (isActive ? "text-primary" : "text-muted-foreground")
                )}
                style={{
                  background: isActive
                    ? isSpecial
                      ? 'linear-gradient(180deg, hsl(200, 75%, 50% / 0.08) 0%, hsl(216, 16%, 8%) 100%)'
                      : 'linear-gradient(180deg, hsl(22, 90%, 52% / 0.08) 0%, hsl(216, 16%, 8%) 100%)'
                    : undefined,
                  borderLeft: isSpecial ? '1px solid hsl(216, 10%, 14%)' : undefined,
                }}
                whileTap={{ scale: 0.92, y: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    className="absolute top-0 left-1 right-1 h-[2px] rounded-full"
                    layoutId="mobileActiveTab"
                    style={{
                      background: isSpecial ? 'hsl(200, 75%, 50%)' : 'hsl(22, 90%, 52%)',
                      boxShadow: isSpecial
                        ? '0 0 8px 2px hsl(200, 75%, 50% / 0.4), 0 0 16px 4px hsl(200, 75%, 50% / 0.15)'
                        : '0 0 8px 2px hsl(22, 90%, 52% / 0.4), 0 0 16px 4px hsl(22, 90%, 52% / 0.15)',
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function MobileChassis({ children }: { children: React.ReactNode }) {
  return (
    <div className="lg:hidden relative">
      {/* Outer chassis frame */}
      <div className="relative chassis-outer-frame rounded-[4px] overflow-hidden" style={{
        margin: '0',
      }}>
        {/* Corner bolts — pinned to true corners with fixed positioning */}
        <div className="fixed top-2 left-2 z-30"><Bolt size="sm" /></div>
        <div className="fixed top-2 right-2 z-30"><Bolt size="sm" /></div>
        <div className="fixed bottom-2 left-2 z-30" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}><Bolt size="sm" /></div>
        <div className="fixed bottom-2 right-2 z-30" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}><Bolt size="sm" /></div>

        {/* Left edge indicator lamps — spread along the full height */}
        <div className="fixed left-1.5 z-20 flex flex-col gap-16" style={{ top: '25%' }}>
          <IndicatorLamp color="amber" size="sm" pulse />
          <IndicatorLamp color="green" size="sm" />
          <IndicatorLamp color="amber" size="sm" flicker />
        </div>

        {/* Right edge indicator lamps — spread along the full height */}
        <div className="fixed right-1.5 z-20 flex flex-col gap-20" style={{ top: '30%' }}>
          <IndicatorLamp color="amber" size="sm" pulse />
          <IndicatorLamp color="amber" size="sm" flicker />
        </div>

        {children}
      </div>
    </div>
  );
}
