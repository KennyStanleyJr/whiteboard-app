import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [react()],
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
