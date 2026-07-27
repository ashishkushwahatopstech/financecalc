import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const atUsernamePlugin = () => ({
  name: 'at-username-routing',
  configureServer(server: any) {
    server.middlewares.use((req: any, _res: any, next: any) => {
      if (req.url && /^\/@[a-zA-Z0-9_]+(\?.*)?$/.test(req.url)) {
        req.url = '/profile.html';
      }
      next();
    });
  }
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), atUsernamePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          loan: path.resolve(__dirname, 'loan-calculator.html'),
          emi: path.resolve(__dirname, 'emi-calculator.html'),
          sip: path.resolve(__dirname, 'sip-calculator.html'),
          gst: path.resolve(__dirname, 'gst-calculator.html'),
          ppf: path.resolve(__dirname, 'ppf-fd-rd-calculator.html'),
          pdf: path.resolve(__dirname, 'pdf-tools.html'),
          image: path.resolve(__dirname, 'image-compressor.html'),
          resume: path.resolve(__dirname, 'resume-builder.html'),
          currency: path.resolve(__dirname, 'currency-converter.html'),
          tax: path.resolve(__dirname, 'tax-calculator.html'),
          salary: path.resolve(__dirname, 'salary-calculator.html'),
          invoice: path.resolve(__dirname, 'invoice-generator.html'),
          roi: path.resolve(__dirname, 'roi-calculator.html'),
          profile: path.resolve(__dirname, 'profile.html'),
          admin: path.resolve(__dirname, 'admin.html'),
          shortener: path.resolve(__dirname, 'url-shortener.html'),
          stats: path.resolve(__dirname, 'link-stats.html'),
          privacy: path.resolve(__dirname, 'privacy-policy.html'),
          terms: path.resolve(__dirname, 'terms-of-service.html'),
          contact: path.resolve(__dirname, 'contact.html'),
          about: path.resolve(__dirname, 'about.html'),
          disclaimer: path.resolve(__dirname, 'disclaimer.html'),
          updates: path.resolve(__dirname, 'updates.html'),
          json: path.resolve(__dirname, 'json-formatter.html'),
          base64: path.resolve(__dirname, 'base64-converter.html'),
          uuid: path.resolve(__dirname, 'uuid-hash-generator.html'),
          regex: path.resolve(__dirname, 'regex-tester.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
