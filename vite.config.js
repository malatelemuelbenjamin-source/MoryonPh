import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const cesiumSource = 'node_modules/cesium/Build/Cesium';

export default defineConfig({
    plugins: [
        react(),
        viteStaticCopy({
            targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
                src: `${cesiumSource}/${dir}`,
                dest: 'cesium',
            })),
        }),
    ],
    base: './',
    define: {
        CESIUM_BASE_URL: JSON.stringify('./cesium'),
    },
});
