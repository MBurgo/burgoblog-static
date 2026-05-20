/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F3EAD6',
        'paper-2': '#EBE0C4',
        'paper-3': '#E0D2AD',
        ink: '#1A140C',
        'ink-2': '#3A2F22',
        'ink-3': '#5A4D3A',
        rule: '#2A221733',
        oxblood: '#8A2A1C',
        'oxblood-2': '#6E2014',
        mustard: '#C58A2E',
        'mustard-text': '#8C5E1A',
        tape: '#F2D26B',
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Newsreader', 'Georgia', 'serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Work Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        track: '0.18em',
        kicker: '0.22em',
        eyebrow: '0.3em',
      },
      boxShadow: {
        cta: '4px 4px 0 #8A2A1C',
      },
    },
  },
  plugins: [],
};
