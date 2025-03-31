/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1a1a',
        paper: '#2d2d2d',
        primary: '#90caf9',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      typography: (theme) => ({
        invert: {
          css: {
            '--tw-prose-body': theme('colors.gray[300]'),
            '--tw-prose-headings': theme('colors.white'),
            '--tw-prose-links': theme('colors.primary'),
            '--tw-prose-bold': theme('colors.white'),
            '--tw-prose-quotes': theme('colors.gray[300]'),
            '--tw-prose-code': theme('colors.white'),
            '--tw-prose-hr': theme('colors.gray[700]'),
            '--tw-prose-th-borders': theme('colors.gray[700]'),
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 