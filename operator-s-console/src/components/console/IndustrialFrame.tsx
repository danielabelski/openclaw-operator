// Industrial machine chassis frame components
// Bolts, side rails, indicator lights, grooves, and knobs

import { useState } from "react";
import { motion } from "framer-motion";

export function Bolt({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-9 h-9' };
  const numPx = { sm: 20, md: 28, lg: 36 };
  const px = numPx[size];

  // Phillips cross slot dimensions
  const slotLen = px * 0.42;
  const slotWidth = px * 0.09;
  const slotDepth = px * 0.06;

  return (
    <div className={`relative ${dims[size]} ${className || ''} group`}>
      {/* Countersunk recess — the hole the bolt sits in */}
      <div className={`${dims[size]} rounded-full transition-transform duration-500 ease-out group-hover:rotate-[25deg]`} style={{
        background: `radial-gradient(circle at 50% 50%, 
          hsl(216, 18%, 3%) 0%, 
          hsl(216, 16%, 5%) 30%,
          hsl(216, 14%, 8%) 60%, 
          hsl(216, 12%, 12%) 100%)`,
        boxShadow: `
          inset 0 3px 6px hsl(216, 20%, 2% / 0.95),
          inset 0 -1px 2px hsl(216, 8%, 18% / 0.3),
          0 0 0 1px hsl(216, 10%, 10%)`,
      }}>
        {/* Bolt head — raised dome sitting in the recess */}
        <div className="absolute rounded-full" style={{
          inset: `${px * 0.1}px`,
          background: `radial-gradient(circle at 38% 32%, 
            hsl(216, 6%, 42%) 0%, 
            hsl(216, 8%, 34%) 15%,
            hsl(216, 8%, 28%) 35%, 
            hsl(216, 10%, 22%) 55%,
            hsl(216, 12%, 16%) 75%, 
            hsl(216, 14%, 10%) 100%)`,
          boxShadow: `
            inset 0 2px 4px hsl(216, 6%, 48% / 0.5), 
            inset 0 -3px 5px hsl(216, 18%, 4% / 0.85),
            0 4px 8px hsl(216, 18%, 2% / 0.8),
            0 2px 3px hsl(216, 18%, 3% / 0.6),
            0 0 0 0.5px hsl(216, 10%, 18% / 0.5)`,
        }}>
          {/* Top specular highlight — convex dome reflection */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `radial-gradient(ellipse 55% 35% at 40% 28%, 
              hsl(216, 4%, 58% / 0.45) 0%, 
              transparent 70%)`,
          }} />

          {/* Machined edge ring */}
          <div className="absolute inset-[1px] rounded-full" style={{
            border: '0.5px solid hsl(216, 8%, 30% / 0.3)',
            boxShadow: 'inset 0 0 0 0.5px hsl(216, 10%, 14% / 0.4)',
          }} />

          {/* Phillips cross recess — deep cavity */}
          {/* Vertical slot */}
          <div className="absolute top-1/2 left-1/2" style={{
            width: `${slotWidth}px`,
            height: `${slotLen}px`,
            transform: 'translate(-50%, -50%)',
            borderRadius: `${slotWidth * 0.3}px`,
            background: `linear-gradient(90deg, 
              hsl(216, 20%, 3%) 0%, 
              hsl(216, 18%, 6%) 30%,
              hsl(216, 16%, 8%) 50%,
              hsl(216, 18%, 5%) 70%, 
              hsl(216, 20%, 3%) 100%)`,
            boxShadow: `
              inset 0 ${slotDepth}px ${slotDepth * 1.5}px hsl(216, 22%, 1% / 0.95),
              inset 0 -${slotDepth * 0.5}px ${slotDepth}px hsl(216, 18%, 3% / 0.7),
              inset ${slotDepth * 0.5}px 0 ${slotDepth}px hsl(216, 20%, 2% / 0.6),
              inset -${slotDepth * 0.5}px 0 ${slotDepth}px hsl(216, 20%, 2% / 0.6),
              0 0.5px 0 hsl(216, 6%, 32% / 0.2)`,
          }} />
          {/* Horizontal slot */}
          <div className="absolute top-1/2 left-1/2" style={{
            width: `${slotLen}px`,
            height: `${slotWidth}px`,
            transform: 'translate(-50%, -50%)',
            borderRadius: `${slotWidth * 0.3}px`,
            background: `linear-gradient(180deg, 
              hsl(216, 20%, 3%) 0%, 
              hsl(216, 18%, 6%) 30%,
              hsl(216, 16%, 8%) 50%,
              hsl(216, 18%, 5%) 70%, 
              hsl(216, 20%, 3%) 100%)`,
            boxShadow: `
              inset ${slotDepth}px 0 ${slotDepth * 1.5}px hsl(216, 22%, 1% / 0.95),
              inset -${slotDepth * 0.5}px 0 ${slotDepth}px hsl(216, 18%, 3% / 0.7),
              inset 0 ${slotDepth * 0.5}px ${slotDepth}px hsl(216, 20%, 2% / 0.6),
              inset 0 -${slotDepth * 0.5}px ${slotDepth}px hsl(216, 20%, 2% / 0.6),
              0 0.5px 0 hsl(216, 6%, 32% / 0.2)`,
          }} />
          {/* Center pit — deepest point where the two slots intersect */}
          <div className="absolute top-1/2 left-1/2 rounded-full" style={{
            width: `${slotWidth * 1.1}px`,
            height: `${slotWidth * 1.1}px`,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, 
              hsl(216, 24%, 1%) 0%, 
              hsl(216, 20%, 4%) 60%, 
              hsl(216, 18%, 6%) 100%)`,
            boxShadow: `inset 0 1px 3px hsl(0, 0%, 0% / 0.9)`,
          }} />
        </div>
      </div>
    </div>
  );
}

export function IndicatorLamp({ color = 'amber', size = 'md', pulse = false, flicker = false }: { 
  color?: 'amber' | 'green' | 'red' | 'blue'; 
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  flicker?: boolean;
}) {
  const colorMap = {
    amber: { core: 'hsl(38, 92%, 50%)', glow: 'hsl(38, 92%, 50%)' },
    green: { core: 'hsl(142, 65%, 45%)', glow: 'hsl(142, 65%, 40%)' },
    red: { core: 'hsl(0, 72%, 50%)', glow: 'hsl(0, 72%, 48%)' },
    blue: { core: 'hsl(200, 75%, 55%)', glow: 'hsl(200, 75%, 50%)' },
  };
  const dims = { sm: 'w-2.5 h-2.5', md: 'w-3.5 h-3.5', lg: 'w-5 h-5' };
  const c = colorMap[color];

  const animClass = flicker ? 'animate-flicker' : pulse ? 'animate-glow-breathe' : '';

  return (
    <div className={`relative ${dims[size]}`}>
      {/* Lamp housing recess */}
      <div className={`absolute inset-0 rounded-full`} style={{
        background: 'hsl(216, 16%, 6%)',
        boxShadow: 'inset 0 2px 4px hsl(216, 18%, 3% / 0.8), 0 0 0 1px hsl(216, 10%, 12%)',
      }} />
      {/* Lamp glow */}
      <div className={`absolute inset-[2px] rounded-full ${animClass}`} style={{
        background: `radial-gradient(circle at 40% 35%, 
          ${c.core} 0%, 
          ${c.core}cc 40%, 
          ${c.core}60 70%, 
          ${c.core}20 100%)`,
        boxShadow: `
          0 0 8px 3px ${c.glow}80, 
          0 0 18px 6px ${c.glow}40, 
          0 0 32px 10px ${c.glow}15,
          inset 0 -1px 2px hsl(0, 0%, 0% / 0.4),
          inset 0 1px 1px ${c.core}80`,
        color: c.glow,
      }} />
    </div>
  );
}

export function MechanicalKnob({ rotation = 45, size = 36, variant = 'standard' }: { 
  rotation?: number; size?: number; variant?: 'standard' | 'heavy' | 'flush';
}) {
  const [hovered, setHovered] = useState(false);
  const knurlCount = variant === 'heavy' ? 48 : 36;
  const totalSize = size + 16;

  return (
    <motion.div
      className="relative cursor-pointer"
      style={{ width: totalSize, height: totalSize }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Deep mounting recess — dark cavity the knob sits in */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle at 50% 48%, 
          hsl(216, 18%, 4%) 0%, 
          hsl(216, 16%, 6%) 50%, 
          hsl(216, 14%, 9%) 70%, 
          hsl(216, 12%, 11%) 85%, 
          hsl(216, 10%, 14%) 100%)`,
        boxShadow: `
          inset 0 6px 12px hsl(216, 20%, 2% / 0.95), 
          inset 0 -2px 4px hsl(216, 10%, 16% / 0.4),
          inset 0 0 0 2px hsl(216, 12%, 8%),
          0 0 0 1px hsl(216, 8%, 18% / 0.6),
          0 1px 0 hsl(216, 8%, 20% / 0.3)`,
      }} />

      {/* Knob body — rotates */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: '5px' }}
        animate={{ rotate: hovered ? rotation + 30 : rotation }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Outer knurled ring — the grippy edge */}
        <div className="absolute inset-0 rounded-full overflow-hidden" style={{
          background: `conic-gradient(
            from 0deg,
            ${Array.from({ length: knurlCount }, (_, i) => {
              const angle = (i / knurlCount) * 360;
              const isRidge = i % 2 === 0;
              return `hsl(216, 8%, ${isRidge ? '30' : '18'}%) ${angle}deg`;
            }).join(', ')}
          )`,
          boxShadow: `
            0 4px 10px hsl(216, 18%, 2% / 0.9),
            0 2px 4px hsl(216, 18%, 3% / 0.7),
            inset 0 0 0 1px hsl(216, 8%, 22% / 0.3)`,
        }}>
          {/* Top light catch on the knurl */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `radial-gradient(ellipse 80% 40% at 48% 18%, 
              hsl(216, 6%, 50% / 0.35) 0%, 
              transparent 60%)`,
          }} />
          {/* Bottom shadow on the knurl */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `radial-gradient(ellipse 80% 40% at 50% 88%, 
              hsl(216, 18%, 3% / 0.5) 0%, 
              transparent 50%)`,
          }} />
        </div>

        {/* Inner face — smooth raised plateau */}
        <div className="absolute rounded-full" style={{
          inset: variant === 'heavy' ? '5px' : '4px',
          background: `conic-gradient(
            from 200deg,
            hsl(216, 8%, 24%) 0deg,
            hsl(216, 10%, 32%) 40deg,
            hsl(216, 8%, 28%) 80deg,
            hsl(216, 10%, 20%) 140deg,
            hsl(216, 12%, 14%) 200deg,
            hsl(216, 10%, 18%) 260deg,
            hsl(216, 8%, 22%) 300deg,
            hsl(216, 10%, 28%) 340deg,
            hsl(216, 8%, 24%) 360deg
          )`,
          boxShadow: `
            inset 0 2px 4px hsl(216, 8%, 36% / 0.4),
            inset 0 -2px 4px hsl(216, 18%, 5% / 0.6),
            0 0 0 1px hsl(216, 10%, 14%)`,
        }}>
          {/* Specular highlight */}
          <div className="absolute inset-0 rounded-full" style={{
            background: `radial-gradient(ellipse 60% 40% at 42% 32%, 
              hsl(216, 6%, 50% / 0.5) 0%, 
              transparent 55%)`,
          }} />

          {/* Concentric ring grooves */}
          <div className="absolute inset-[3px] rounded-full" style={{
            border: '1px solid hsl(216, 10%, 16% / 0.6)',
            boxShadow: 'inset 0 0 0 1px hsl(216, 8%, 28% / 0.2)',
          }} />
          <div className="absolute inset-[6px] rounded-full" style={{
            border: '0.5px solid hsl(216, 10%, 14% / 0.4)',
            boxShadow: 'inset 0 0 0 0.5px hsl(216, 8%, 26% / 0.15)',
          }} />

          {/* Center hub — raised dome */}
          <div className="absolute top-1/2 left-1/2 rounded-full" style={{
            width: size * 0.24,
            height: size * 0.24,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle at 40% 36%, 
              hsl(216, 6%, 38%) 0%, 
              hsl(216, 8%, 28%) 40%,
              hsl(216, 10%, 20%) 70%, 
              hsl(216, 12%, 14%) 100%)`,
            boxShadow: `
              inset 0 1px 3px hsl(216, 8%, 44% / 0.5),
              inset 0 -2px 3px hsl(216, 18%, 5% / 0.7),
              0 2px 4px hsl(216, 18%, 3% / 0.5),
              0 0 0 0.5px hsl(216, 10%, 18%)`,
          }} />

          {/* Position indicator — amber line */}
          <div
            className="absolute top-1/2 left-1/2"
            style={{
              width: '2.5px',
              height: size * 0.28,
              background: hovered 
                ? 'linear-gradient(180deg, hsl(38, 95%, 65%) 0%, hsl(38, 90%, 50%) 100%)' 
                : 'linear-gradient(180deg, hsl(38, 92%, 55%) 0%, hsl(38, 88%, 42%) 100%)',
              transformOrigin: 'center bottom',
              transform: `translate(-50%, -100%)`,
              borderRadius: '1.5px',
              boxShadow: hovered
                ? '0 0 12px 3px hsl(38, 92%, 50% / 0.9), 0 0 24px 6px hsl(38, 92%, 50% / 0.4)'
                : '0 0 8px 2px hsl(38, 92%, 50% / 0.6), 0 0 16px 4px hsl(38, 92%, 50% / 0.2)',
              transition: 'box-shadow 0.25s, background 0.25s',
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function PressureGauge({ value = 0.65, size = 48 }: { value?: number; size?: number }) {
  const angle = -135 + (value * 270); // -135 to +135 range
  const totalSize = size + 12;

  return (
    <div className="relative" style={{ width: totalSize, height: totalSize }}>
      {/* Deep recess */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `radial-gradient(circle at 50% 48%, 
          hsl(216, 18%, 4%) 0%, 
          hsl(216, 16%, 6%) 40%, 
          hsl(216, 14%, 9%) 70%, 
          hsl(216, 12%, 12%) 100%)`,
        boxShadow: `
          inset 0 4px 10px hsl(216, 20%, 2% / 0.9),
          inset 0 -2px 4px hsl(216, 10%, 16% / 0.3),
          0 0 0 1.5px hsl(216, 10%, 14%),
          0 1px 0 hsl(216, 8%, 20% / 0.3)`,
      }} />

      {/* Gauge face */}
      <div className="absolute rounded-full" style={{
        inset: '4px',
        background: `radial-gradient(circle at 45% 40%, 
          hsl(216, 6%, 18%) 0%, 
          hsl(216, 8%, 12%) 50%, 
          hsl(216, 10%, 8%) 100%)`,
        boxShadow: `
          inset 0 1px 3px hsl(216, 8%, 26% / 0.4),
          inset 0 -1px 3px hsl(216, 18%, 3% / 0.5)`,
      }}>
        {/* Tick marks around the edge */}
        {Array.from({ length: 9 }, (_, i) => {
          const tickAngle = -135 + (i * (270 / 8));
          const isMajor = i % 2 === 0;
          return (
            <div key={i} className="absolute top-1/2 left-1/2" style={{
              width: isMajor ? '2px' : '1px',
              height: isMajor ? `${size * 0.16}px` : `${size * 0.1}px`,
              background: isMajor ? 'hsl(216, 6%, 40%)' : 'hsl(216, 6%, 28%)',
              transformOrigin: 'center bottom',
              transform: `translate(-50%, -100%) rotate(${tickAngle}deg) translateY(-${size * 0.3}px)`,
            }} />
          );
        })}

        {/* Needle */}
        <div className="absolute top-1/2 left-1/2" style={{
          width: '1.5px',
          height: `${size * 0.32}px`,
          background: 'linear-gradient(180deg, hsl(0, 72%, 55%) 0%, hsl(0, 65%, 40%) 100%)',
          transformOrigin: 'center bottom',
          transform: `translate(-50%, -100%) rotate(${angle}deg)`,
          boxShadow: '0 0 6px 1px hsl(0, 72%, 48% / 0.5)',
          borderRadius: '1px',
        }} />

        {/* Center pivot */}
        <div className="absolute top-1/2 left-1/2 rounded-full" style={{
          width: size * 0.12,
          height: size * 0.12,
          transform: 'translate(-50%, -50%)',
          background: `radial-gradient(circle at 40% 36%, 
            hsl(216, 6%, 36%) 0%, 
            hsl(216, 10%, 20%) 60%, 
            hsl(216, 12%, 14%) 100%)`,
          boxShadow: `
            inset 0 1px 2px hsl(216, 8%, 40% / 0.5),
            0 1px 3px hsl(216, 18%, 3% / 0.5)`,
        }} />
      </div>
    </div>
  );
}

export function ToggleSwitch({ on = false, size = 'md' }: { on?: boolean; size?: 'sm' | 'md' }) {
  const [isOn, setIsOn] = useState(on);
  const w = size === 'sm' ? 22 : 28;
  const h = size === 'sm' ? 12 : 14;
  const thumbSize = size === 'sm' ? 8 : 10;

  return (
    <motion.div
      className="relative cursor-pointer rounded-full"
      style={{
        width: w,
        height: h,
        background: `linear-gradient(180deg, 
          hsl(216, 16%, 6%) 0%, 
          hsl(216, 14%, 10%) 100%)`,
        boxShadow: `
          inset 0 2px 4px hsl(216, 18%, 3% / 0.8),
          inset 0 0 0 1px hsl(216, 10%, 12%),
          0 1px 0 hsl(216, 8%, 18% / 0.3)`,
      }}
      onClick={() => setIsOn(!isOn)}
      whileTap={{ scale: 0.95 }}
    >
      {/* Glow when on */}
      {isOn && (
        <div className="absolute inset-[1px] rounded-full" style={{
          background: 'hsl(142, 65%, 40% / 0.15)',
          boxShadow: 'inset 0 0 6px hsl(142, 65%, 40% / 0.2)',
        }} />
      )}
      {/* Thumb */}
      <motion.div
        className="absolute top-1/2 rounded-full"
        style={{
          width: thumbSize,
          height: thumbSize,
          y: '-50%',
          background: isOn
            ? `radial-gradient(circle at 40% 35%, hsl(142, 55%, 50%), hsl(142, 60%, 35%))`
            : `radial-gradient(circle at 40% 35%, hsl(216, 6%, 36%), hsl(216, 10%, 22%))`,
          boxShadow: isOn
            ? `0 0 6px 2px hsl(142, 65%, 40% / 0.5), inset 0 1px 1px hsl(142, 50%, 60% / 0.4)`
            : `inset 0 1px 1px hsl(216, 8%, 40% / 0.4), 0 1px 3px hsl(216, 18%, 3% / 0.5)`,
        }}
        animate={{ x: isOn ? w - thumbSize - 3 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </motion.div>
  );
}

export function SideRail({ side }: { side: 'left' | 'right' }) {
  const isRight = side === 'right';

  return (
    <div className="hidden lg:flex flex-col items-center shrink-0 py-4 gap-3 side-rail brushed-metal" style={{
      width: '100px',
      borderLeft: isRight ? '3px solid hsl(216, 10%, 14%)' : 'none',
      borderRight: !isRight ? '3px solid hsl(216, 10%, 14%)' : 'none',
      background: `linear-gradient(${!isRight ? '90deg' : '270deg'}, 
        hsl(216, 14%, 7%) 0%, 
        hsl(216, 12%, 11%) 20%, 
        hsl(216, 10%, 14%) 40%, 
        hsl(216, 12%, 15%) 50%, 
        hsl(216, 10%, 13%) 60%, 
        hsl(216, 12%, 11%) 80%, 
        hsl(216, 14%, 8%) 100%)`,
      boxShadow: !isRight 
        ? 'inset -4px 0 12px hsl(216, 18%, 3% / 0.5)' 
        : 'inset 4px 0 12px hsl(216, 18%, 3% / 0.5)',
    }}>
      {/* Top bolt */}
      <Bolt size="md" />

      {/* Pressure gauge */}
      <PressureGauge value={isRight ? 0.72 : 0.45} size={isRight ? 44 : 40} />

      {/* Horizontal panel cutout */}
      <PanelCutout orientation="horizontal" />

      {/* Toggle switch pair */}
      <div className="flex flex-col items-center gap-1.5">
        <ToggleSwitch on={!isRight} size="md" />
        <ToggleSwitch on={isRight} size="sm" />
      </div>

      {/* Conduit with connector fitting */}
      <ConduitPipe height={36} />
      <ConnectorFitting />
      <ConduitPipe height={24} />

      {/* Amber lamp block */}
      <div className="flex gap-1">
        <RectLamp color="amber" />
        <RectLamp color="amber" />
      </div>

      {/* Main knob */}
      <MechanicalKnob rotation={45} size={isRight ? 42 : 36} variant="heavy" />

      {/* Vertical detail strip */}
      <PanelCutout orientation="vertical" height={40} />

      {/* Conduit section */}
      <ConduitPipe height={40} />
      <ConnectorFitting />

      {/* Second gauge — smaller */}
      <PressureGauge value={isRight ? 0.3 : 0.85} size={32} />

      {/* Toggle row */}
      <div className="flex gap-2 items-center">
        <ToggleSwitch on size="sm" />
        <RectLamp color={isRight ? 'green' : 'amber'} size="sm" glow />
      </div>

      {/* Indicator block */}
      <div className="flex flex-col gap-1.5">
        <RectLamp color="amber" />
        <RectLamp color="amber" glow />
      </div>

      {/* Small cutout panel */}
      <PanelCutout orientation="horizontal" />

      {/* Second knob */}
      <MechanicalKnob rotation={-20} size={isRight ? 36 : 34} variant="flush" />

      {/* Lower conduit */}
      <ConduitPipe height={32} />

      {/* Bottom lamp stack */}
      <div className="flex flex-col gap-1.5">
        <RectLamp color="amber" glow />
        <div className="flex gap-1">
          <RectLamp color="amber" size="sm" />
          <RectLamp color="amber" size="sm" />
          <RectLamp color="amber" size="sm" />
        </div>
      </div>

      <PanelCutout orientation="horizontal" />

      {/* Bottom bolt */}
      <Bolt size="md" />
    </div>
  );
}

/* === Sub-components for rail details === */

function ConduitPipe({ height = 56 }: { height?: number }) {
  return (
    <div className="relative" style={{ width: '14px', height }}>
      {/* Pipe body */}
      <div className="absolute inset-0 rounded-full" style={{
        background: `linear-gradient(90deg, 
          hsl(216, 10%, 8%) 0%, 
          hsl(216, 8%, 16%) 20%, 
          hsl(216, 8%, 22%) 40%, 
          hsl(216, 6%, 26%) 50%,
          hsl(216, 8%, 20%) 60%, 
          hsl(216, 8%, 14%) 80%, 
          hsl(216, 10%, 8%) 100%)`,
        boxShadow: `
          inset 2px 0 4px hsl(216, 10%, 30% / 0.3), 
          inset -2px 0 4px hsl(216, 18%, 5% / 0.5), 
          0 2px 4px hsl(216, 18%, 3% / 0.3)`,
      }} />
      {/* Pipe highlight stripe */}
      <div className="absolute top-0 bottom-0 rounded-full" style={{
        left: '40%',
        width: '2px',
        background: 'linear-gradient(180deg, hsl(216, 6%, 30% / 0.4) 0%, hsl(216, 6%, 30% / 0.1) 50%, hsl(216, 6%, 30% / 0.4) 100%)',
      }} />
    </div>
  );
}

function ConnectorFitting() {
  return (
    <div className="relative" style={{ width: '28px', height: '12px' }}>
      {/* Connector housing */}
      <div className="absolute inset-0 rounded-sm" style={{
        background: `linear-gradient(180deg, 
          hsl(216, 8%, 24%) 0%, 
          hsl(216, 10%, 18%) 30%, 
          hsl(216, 10%, 14%) 70%, 
          hsl(216, 8%, 20%) 100%)`,
        boxShadow: `
          inset 0 1px 0 hsl(216, 8%, 32% / 0.5),
          inset 0 -1px 0 hsl(216, 18%, 6% / 0.5),
          0 2px 4px hsl(216, 18%, 3% / 0.4)`,
        border: '1px solid hsl(216, 10%, 12%)',
      }} />
      {/* Center groove */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm" style={{
        width: '16px',
        height: '4px',
        background: 'hsl(216, 14%, 8%)',
        boxShadow: 'inset 0 1px 2px hsl(216, 18%, 3% / 0.6)',
      }} />
    </div>
  );
}

function PanelCutout({ orientation = 'horizontal', height = 20 }: { orientation?: 'horizontal' | 'vertical'; height?: number }) {
  const isHoriz = orientation === 'horizontal';
  return (
    <div style={{
      width: isHoriz ? '56px' : '18px',
      height: isHoriz ? '14px' : `${height}px`,
      background: `linear-gradient(${isHoriz ? '180deg' : '90deg'}, 
        hsl(216, 14%, 7%) 0%, 
        hsl(216, 16%, 5%) 50%, 
        hsl(216, 14%, 7%) 100%)`,
      border: '1.5px solid hsl(216, 10%, 12%)',
      borderRadius: '2px',
      boxShadow: `
        inset 0 2px 4px hsl(216, 18%, 3% / 0.7),
        inset 0 0 0 0.5px hsl(216, 10%, 8%),
        0 1px 0 hsl(216, 8%, 18% / 0.3)`,
    }}>
      {/* Inner detail lines */}
      {isHoriz && (
        <div className="flex items-center justify-center h-full gap-1 px-2">
          {[0,1,2,3].map(i => (
            <div key={i} className="flex-1 h-px" style={{
              background: 'hsl(216, 8%, 16%)',
              boxShadow: '0 1px 0 hsl(216, 8%, 22% / 0.2)',
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

function RectLamp({ color = 'amber', size = 'md', glow = false }: { 
  color?: 'amber' | 'green' | 'red'; 
  size?: 'sm' | 'md';
  glow?: boolean;
}) {
  const colors = {
    amber: { core: 'hsl(30, 85%, 45%)', bright: 'hsl(35, 90%, 55%)', glow: 'hsl(35, 90%, 50%)' },
    green: { core: 'hsl(142, 60%, 35%)', bright: 'hsl(142, 65%, 45%)', glow: 'hsl(142, 65%, 40%)' },
    red: { core: 'hsl(0, 65%, 40%)', bright: 'hsl(0, 70%, 50%)', glow: 'hsl(0, 72%, 48%)' },
  };
  const c = colors[color];
  const w = size === 'sm' ? 8 : 12;
  const h = size === 'sm' ? 6 : 8;

  return (
    <div className="relative" style={{ width: w, height: h }}>
      {/* Lamp recess */}
      <div className="absolute inset-0 rounded-[1px]" style={{
        background: 'hsl(216, 16%, 5%)',
        boxShadow: 'inset 0 1px 2px hsl(216, 18%, 3% / 0.8), 0 0 0 0.5px hsl(216, 10%, 10%)',
      }} />
      {/* Lamp face */}
      <div className={`absolute inset-[1px] rounded-[0.5px] ${glow ? 'animate-glow-breathe' : ''}`} style={{
        background: `linear-gradient(180deg, ${c.bright} 0%, ${c.core} 100%)`,
        boxShadow: glow
          ? `0 0 6px 2px ${c.glow}90, 0 0 14px 4px ${c.glow}40, inset 0 1px 0 ${c.bright}80`
          : `0 0 3px 1px ${c.glow}50, inset 0 1px 0 ${c.bright}60`,
        color: c.glow,
      }} />
    </div>
  );
}
export function FrameCornerBolts() {
  return (
    <>
      <Bolt className="absolute top-3 left-3 z-20" size="lg" />
      <Bolt className="absolute top-3 right-3 z-20" size="lg" />
      <Bolt className="absolute bottom-3 left-3 z-20" size="lg" />
      <Bolt className="absolute bottom-3 right-3 z-20" size="lg" />
    </>
  );
}

export function FrameGroove({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  if (orientation === 'horizontal') {
    return (
      <div className="w-full" style={{
        height: '5px',
        background: `linear-gradient(180deg, 
          hsl(216, 18%, 5%) 0%, hsl(216, 10%, 12%) 35%, hsl(216, 10%, 20%) 50%, hsl(216, 10%, 12%) 65%, hsl(216, 18%, 5%) 100%)`,
      }} />
    );
  }
  return (
    <div className="h-full" style={{
      width: '5px',
      background: `linear-gradient(90deg, 
        hsl(216, 18%, 5%) 0%, hsl(216, 10%, 12%) 35%, hsl(216, 10%, 20%) 50%, hsl(216, 10%, 12%) 65%, hsl(216, 18%, 5%) 100%)`,
    }} />
  );
}
