import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import prefetch from '@astrojs/prefetch'

import image from '@astrojs/image'

// https://astro.build/config
export default defineConfig({
	integrations: [
		tailwind({
			applyBaseStyles: false,
		}),
		prefetch(),
		image({
			serviceEntryPoint: '@astrojs/image/sharp',
		}),
	],
})
