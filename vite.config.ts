import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'


const z3RuntimeDir = resolve(fileURLToPath(new URL('../../z3', import.meta.url)))
const contentTypes: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
}

function z3RuntimePlugin(): Plugin {
  return {
    name: 'serve-z3-runtime',
    configureServer(server) {
      server.middlewares.use('/z3', (request, response, next) => {
        const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname
        const filePath = resolve(z3RuntimeDir, `.${requestPath}`)
        if (relative(z3RuntimeDir, filePath).startsWith('..') || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next()
          return
        }

        response.setHeader('Content-Type', contentTypes[extname(filePath)] ?? 'application/octet-stream')
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
        response.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        createReadStream(filePath).pipe(response)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), z3RuntimePlugin()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
})
