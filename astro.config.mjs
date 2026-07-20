import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://zx50416.github.io',
  base: '/WikiNB-KCIS/',
  integrations: [tailwind()],
  devToolbar: {
    enabled: false,
  },
});
