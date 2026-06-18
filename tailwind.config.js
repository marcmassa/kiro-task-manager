/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#1a1b26",
          50: "#f8f9fa",
          100: "#24253a",
          200: "#1f2033",
          300: "#1a1b26",
          400: "#15161f",
          500: "#111219",
          600: "#0d0e14",
          700: "#090a0f",
          800: "#06070a",
          900: "#030305",
        },
        accent: {
          DEFAULT: "#7c5cfc",
          50: "#f3f0ff",
          100: "#e9e4ff",
          200: "#d4ccfe",
          300: "#b4a5fd",
          400: "#9580fc",
          500: "#7c5cfc",
          600: "#6842f5",
          700: "#5733e0",
          800: "#4829b8",
          900: "#3b2196",
        },
        success: {
          DEFAULT: "#10b981",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        warning: {
          DEFAULT: "#f59e0b",
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
        },
        danger: {
          DEFAULT: "#ef4444",
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
        },
        muted: {
          DEFAULT: "#6b7280",
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
        },
        // ── AWS Brand palette ────────────────────────────────────────
        // Used via Tailwind classes (bg-squid, border-aws-orange, etc.)
        // so components never need hex literals.
        squid: {
          DEFAULT: "#252F3E",
          light: "#2d3a4e",
          dark: "#1a2230",
        },
        "aws-orange": {
          DEFAULT: "#FF9900",
          muted: "#cc7a00",
          subtle: "#fff3e0",
        },
        "aws-green": {
          DEFAULT: "#037F0C",
          muted: "#025f09",
          subtle: "#e6f4e7",
        },
        "aws-red": {
          DEFAULT: "#D91515",
          muted: "#b01010",
          subtle: "#fce8e8",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 20px rgba(124, 92, 252, 0.15)",
        card: "0 2px 8px rgba(0, 0, 0, 0.3)",
        "card-hover": "0 8px 24px rgba(0, 0, 0, 0.4)",
        modal: "0 24px 48px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "kiro-float": "kiroFloat 4s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        kiroFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};
