/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base:     'var(--color-bg-base)',
        elevated: 'var(--color-bg-elevated)',
        surface:  'var(--color-bg-surface)',
        hover:    'var(--color-bg-hover)',
        border:   'var(--color-border)',
        'border-light': 'var(--color-border-light)',
        primary:  'var(--color-text-primary)',
        muted:    'var(--color-text-muted)',
        accent:   'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        'accent-dim':   'var(--color-accent-dim)',
        success:  'var(--color-success)',
        warning:  'var(--color-warning)',
        error:    'var(--color-error)',
      },
      fontFamily: {
        sans: ['"Motiva Sans"', '"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
