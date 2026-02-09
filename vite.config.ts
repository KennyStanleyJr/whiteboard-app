import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'prompt',
			devOptions: { enabled: false },
			manifest: {
				name: 'Whiteboard',
				short_name: 'Whiteboard',
				description: 'Infinite whiteboard for text, images, videos, links, post-it notes, and arrows.',
				theme_color: '#f5f5f5',
				background_color: '#f5f5f5',
				display: 'standalone',
				orientation: 'any',
				icons: [
					{ src: '/pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				cleanupOutdatedCaches: true,
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
			},
		}),
	],
	build: {
		chunkSizeWarningLimit: 1600, // tldraw SDK is a single large chunk
		rollupOptions: {
			output: {
				manualChunks(id: string): string | undefined {
					if (!id.includes('node_modules')) return undefined
					if (id.includes('tldraw')) return 'tldraw'
					if (id.includes('react-dom') || id.includes('react/')) return 'react'
					return undefined
				},
			},
		},
	},
})
