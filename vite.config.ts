import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths make the build work both at a custom domain
  // and at https://username.github.io/repository-name/.
  base: './',
  server: {
    host: true,
    // Облачные превью (Codespaces, e2b, …) открывают dev-сервер по своему домену.
    // Без этой строки Vite отвечает 403 «Blocked request. This host is not allowed».
    // Локальный localhost разрешён и так, проверка остальных хостов сохраняется.
    allowedHosts: ['.e2b.app'],
  },
});
