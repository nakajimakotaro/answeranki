import daisyui from 'daisyui';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html", // Relative to the 'web' directory now
    "./src/**/*.{js,ts,jsx,tsx}", // Relative to the 'web' directory now
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#6b7280',
        accent: '#f59e0b',
        background: '#f9fafb',
        text: '#1f2937',
        error: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
      gridTemplateColumns: {
        '53': 'repeat(53, minmax(0, 1fr))',
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      },
      borderRadius: {
        'sm': '0.125rem',
        DEFAULT: '0.25rem',
        'md': '0.375rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        '2xl': '1rem',
        'full': '9999px',
      },
    },
  },
  plugins: [
    daisyui, // Use the imported variable
  ],
  // Optional: Add DaisyUI specific configurations if needed
  // daisyui: {
  //   themes: ["light", "dark"], // example themes
  // },
}
