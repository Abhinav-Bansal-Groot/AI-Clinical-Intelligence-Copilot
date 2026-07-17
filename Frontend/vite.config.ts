import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    allowedHosts: [
      "bdda-59-144-248-14.ngrok-free.app","14b8-59-144-248-14.ngrok-free.app"
    ]
  }
})