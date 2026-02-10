import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			injectRegister: null,
			manifest: {
				name: 'Whiteboard',
				short_name: 'Whiteboard',
				description: 'Infinite whiteboard for text, images, videos, links, post-it notes, and arrows.',
				start_url: '/',
				id: '/',
				theme_color: '#0f0f11',
				background_color: '#0f0f11',
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
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // Excalidraw chunk ~4.4 MB
			},
		}),
	],
	build: {
		chunkSizeWarningLimit: 5500, // Excalidraw chunk ~5.1 MB
		rollupOptions: {
			output: {
				manualChunks(id: string): string | undefined {
					if (!id.includes('node_modules')) return undefined
					if (id.includes('excalidraw')) return 'excalidraw'
					if (id.includes('react-dom') || id.includes('react/')) return 'react'
					return undefined
				},
			},
		},
	},
})
