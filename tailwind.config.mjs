/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        kc: {
          blue: '#1b4f9c',
          'blue-deep': '#0e2f66',
          'blue-soft': '#4f7ec8',
          purple: '#6b3d9a',
          'purple-deep': '#4a256e',
          'purple-soft': '#8f6bb8',
          mist: '#f4f1fa',
          ink: '#1a1d2e',
          muted: '#5c6478',
        },
      },
      fontFamily: {
        display: ['Nunito', 'Noto Sans TC', 'sans-serif'],
        body: ['Noto Sans TC', 'Nunito', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        kc: '0 10px 30px rgba(14, 47, 102, 0.06)',
        'kc-lg': '0 16px 40px rgba(27, 79, 156, 0.14)',
        soft: '0 18px 48px rgba(14, 47, 102, 0.08)',
      },
      animation: {
        fadeIn: 'fadeIn 0.45s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
