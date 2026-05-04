/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@auction/ui/tailwind.preset')],
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};
