import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  variant?: "fade-up" | "fade-left" | "fade-right" | "scale" | "mechanical";
  delay?: number;
}

export function ScrollReveal({
  children,
  className,
  variant = "fade-up",
  delay = 0,
}: ScrollRevealProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "scroll-reveal",
        `scroll-reveal--${variant}`,
        isVisible && "scroll-reveal--visible",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
