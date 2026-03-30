import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        display: ["Orbitron", "JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        status: {
          healthy: "hsl(var(--status-healthy))",
          warning: "hsl(var(--status-warning))",
          error: "hsl(var(--status-error))",
          info: "hsl(var(--status-info))",
          neutral: "hsl(var(--status-neutral))",
          approval: "hsl(var(--status-approval))",
        },
        panel: {
          DEFAULT: "hsl(var(--panel))",
          border: "hsl(var(--panel-border))",
          highlight: "hsl(var(--panel-highlight))",
          inset: "hsl(var(--panel-inset))",
          raised: "hsl(var(--panel-raised))",
        },
        indicator: {
          green: "hsl(var(--indicator-green))",
          amber: "hsl(var(--indicator-amber))",
          red: "hsl(var(--indicator-red))",
          blue: "hsl(var(--indicator-blue))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "glow-breathe": {
          "0%, 100%": { boxShadow: "0 0 8px 2px currentColor" },
          "50%": { boxShadow: "0 0 16px 5px currentColor" },
        },
        "flicker": {
          "0%, 100%": { opacity: "1" },
          "4%": { opacity: "0.3" },
          "6%": { opacity: "0.9" },
          "8%": { opacity: "0.4" },
          "10%": { opacity: "1" },
          "50%": { opacity: "1" },
          "52%": { opacity: "0.6" },
          "54%": { opacity: "1" },
          "80%": { opacity: "1" },
          "82%": { opacity: "0.5" },
          "84%": { opacity: "0.9" },
          "86%": { opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "activity-slide-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "activity-slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-subtle": "pulse-subtle 2.5s ease-in-out infinite",
        "glow-breathe": "glow-breathe 3s ease-in-out infinite",
        "flicker": "flicker 4s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "activity-slide-down": "activity-slide-down 0.25s ease-out",
        "activity-slide-up": "activity-slide-up 0.25s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
