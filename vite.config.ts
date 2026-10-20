import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(() => {
	return {
		plugins: [cloudflare(), react()],
		// Excalidraw reads this at module load; required when bundling it with Vite.
		define: { 'process.env.IS_PREACT': JSON.stringify('false') },
	}
})
