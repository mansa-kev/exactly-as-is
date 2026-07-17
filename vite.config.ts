import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      esbuildOptions: {
        drop: isProduction ? ['console', 'debugger'] : [],
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            if (id.includes('html2pdf.js') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'html2pdf';
            }

            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts';
            }

            if (id.includes('@supabase/supabase-js') || id.includes('@supabase/')) {
              return 'supabase';
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('scheduler') ||
              id.includes('use-sync-external-store')
            ) {
              return 'react-core';
            }

            if (id.includes('react-router') || id.includes('@remix-run/router')) {
              return 'router';
            }

            if (id.includes('lucide-react') || id.includes('/motion/')) {
              return 'ui-vendor';
            }

            if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
              return 'forms';
            }

            if (id.includes('@dnd-kit')) {
              return 'dnd-kit';
            }

            if (id.includes('sonner')) {
              return 'sonner';
            }

            if (id.includes('react-signature-canvas') || id.includes('signature_pad')) {
              return 'signature';
            }

            if (id.includes('react-helmet')) {
              return 'helmet';
            }

            if (id.includes('date-fns')) {
              return 'date-fns';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
