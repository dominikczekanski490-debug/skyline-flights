import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { writeFileSync, mkdirSync } from 'fs'
let sha = 'local'; try { sha = execSync('git rev-parse --short HEAD').toString().trim() } catch {}
const BUILD = `${sha}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`
export default defineConfig({ define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), { name: 'build-stamp', closeBundle() { mkdirSync('dist', { recursive: true }); writeFileSync('dist/version.json', JSON.stringify({ build: BUILD })) } }],
  server: { proxy: { '/api': 'http://localhost:8787' } }, build: { chunkSizeWarningLimit: 2000 } })
