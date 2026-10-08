import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });
await cp('public', 'dist', { recursive: true });
await cp('node_modules/leaflet/dist', 'dist/vendor/leaflet', { recursive: true });
await cp('node_modules/leaflet/LICENSE', 'dist/vendor/leaflet/LICENSE');
console.log('Built dist/ — static files only; server API key is never bundled.');
