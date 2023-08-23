/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			spacing: {
				'1/3': '33%',
				'1/2': '50%',
				'16/9': '56.25%',
				full: '100%',
			},
			colors: {
				transparent: 'transparent',
				burgundy: '#9f3e52',
			},
			fontFamily: {
				body: ['Roboto', 'Open Sans', 'ui-sans-serif'],
				title: ['GT Sectra Bold', 'ui-serif'],
				serif: ['GT Sectra Bold', 'ui-serif'],
			},
		},
	},
	plugins: [require('@tailwindcss/typography'), require('@tailwindcss/line-clamp')],
}
