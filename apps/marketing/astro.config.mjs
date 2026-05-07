import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

// Astro 5: static by default. Mark dynamic pages with
//   export const prerender = false;
// to opt them into per-request SSR via the Vercel adapter.
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  server: {
    port: 4321,
  },
  site: process.env.PUBLIC_SITE_URL ?? 'https://auctionit.ai',
});
