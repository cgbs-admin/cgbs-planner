// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // 1) Typography
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },

      fontSize: {
        // tuned to your UI density
        xs: ["0.70rem", { lineHeight: "1rem" }],
        sm: ["0.78rem", { lineHeight: "1.15rem" }],
        base: ["0.9rem", { lineHeight: "1.35rem" }],
        lg: ["1.05rem", { lineHeight: "1.5rem" }],
        xl: ["1.25rem", { lineHeight: "1.6rem" }],
        "2xl": ["1.5rem", { lineHeight: "1.7rem" }],
      },

      // 2) Color system, derived from the CGBS palette
      colors: {
        // Text colors (manual: black or white text only) :contentReference[oaicite:1]{index=1}
        ink: {
          DEFAULT: "#222222", // primary body text
          muted: "#4B4B4B",   // secondary labels
          subtle: "#6B7280",  // helper text
          inverted: "#FFFFFF",
        },

        // Neutral surfaces – based on the light pastel greys and off-whites
        // shown across the manual (e.g. #f7f6f4, #ecf1f4, #e9e9e9). :contentReference[oaicite:2]{index=2}
        surface: {
          page: "#F7F6F4",   // overall page background
          subtle: "#ECF1F4", // filter strips, subtle sections
          card: "#FFFFFF",   // cards
          soft: "#E9E9E9",   // separators, light blocks
          strong: "#DEE5E2", // strong neutral blocks
        },

        // Brand / accent palette – taken from gedämpfte + kräftige Farben. :contentReference[oaicite:3]{index=3}
        brand: {
          primary: "#3261A8",    // deep blue (#3261a8)
          primarySoft: "#BFCDEA", // soft blue (#bfcdea)
          accent: "#AFA1CB",     // soft purple (#afa1cb)
          accentSoft: "#E7E1ED", // pale lilac (#e7e1ed)
          highlight: "#E5DF62",  // yellow highlight (#e5df62)
        },

        // Semantic-ish colors, still kept muted to match the style
        state: {
          success: "#63AFA0", // greenish (from #63afa0)
          warning: "#F0CB61", // warm yellow
          danger: "#CD5755",  // muted red
        },

        // You can still use Tailwind's default gray/blue/etc if you want
      },

      // 3) Radius tokens – for consistent rounded corners
      borderRadius: {
        none: "0px",
        sm: "4px",
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        card: "12px",
        pill: "9999px",
      },

      // 4) Shadow tokens – restrained, soft shadows
      boxShadow: {
        card: "0 1px 3px rgba(15, 23, 42, 0.08)",
        cardStrong: "0 4px 18px rgba(15, 23, 42, 0.16)",
        overlay: "0 10px 40px rgba(15, 23, 42, 0.45)",
      },

      // 5) Spacing tweaks (you still have the full default scale)
      spacing: {
        "2.5": "0.625rem",
        "3.5": "0.875rem",
        4.5: "1.125rem",
      },

      // 6) Transition helpers
      transitionDuration: {
        fast: "120ms",
        normal: "180ms",
        slow: "260ms",
      },
    },
  },
  plugins: [],
};
