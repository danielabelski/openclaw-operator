import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}

export function useIsNotDesktop() {
  const [isNotDesktop, setIsNotDesktop] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${DESKTOP_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsNotDesktop(window.innerWidth < DESKTOP_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsNotDesktop(window.innerWidth < DESKTOP_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isNotDesktop;
}
