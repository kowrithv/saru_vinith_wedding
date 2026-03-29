import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        champagne: {
          DEFAULT: '#F5E6C8',
          light: '#FAF0DC',
          dark: '#E8D5B7',
        },
        'baby-blue': {
          DEFAULT: '#B8D4E8',
          light: '#D4E8F5',
          dark: '#A0BFDA',
        },
        'dark-blue': {
          DEFAULT: '#1E3A5F',
          light: '#2C4F7C',
          dark: '#152940',
        },
        gold: {
          DEFAULT: '#C9A84C',
          light: '#D4B96A',
          dark: '#A8892E',
        },
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #FAF0DC 0%, #ffffff 40%, #D4E8F5 100%)',
        'section-gradient': 'linear-gradient(180deg, #ffffff 0%, #FAF0DC 100%)',
      },
    },
  },
  plugins: [],
}

export default config
