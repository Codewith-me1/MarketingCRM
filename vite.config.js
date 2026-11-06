import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { handleSuccessAi } from './server/successai.js';

/** Serves /api/successai during `npm run dev` with the same handler Vercel uses in production. */
function successAiDevApi(env) {
  return {
    name: 'successai-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/successai', (req, res) => {
        let raw = '';
        req.on('data', chunk => {
          raw += chunk;
          if (raw.length > 2000000) req.destroy();
        });
        req.on('end', async () => {
          let body = null;
          try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
          const result = await handleSuccessAi({ method: req.method, authorization: req.headers.authorization, body, env });
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(result.body));
        });
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // '' prefix loads server-only variables (e.g. SUPABASE_SECRET_KEY) for the dev API only;
  // they are never exposed to browser code, which only receives VITE_* variables.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  return {
    plugins: [react(), successAiDevApi(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          // Vendor code changes rarely; separate chunks stay cached between app deploys.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase') || id.includes('iceberg-js')) return 'supabase';
            if (id.includes('react-router')) return 'router';
            if (id.includes('react-icons')) return 'icons';
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            return undefined;
          }
        }
      }
    }
  };
});
