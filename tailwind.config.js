/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        customText: 'var(--text-main)',
        mutedText: 'var(--text-muted)',
        subtleBorder: 'var(--border-color)',
        accentGlow: 'var(--accent-glow)',
        glassSurface: 'var(--glass-bg)',
      },
      boxShadow: {
        'neon-glass': '0 12px 32px -12px rgba(2, 6, 23, 0.2), 0 0 24px -8px var(--accent-glow)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
