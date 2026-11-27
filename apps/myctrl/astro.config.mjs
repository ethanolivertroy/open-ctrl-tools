// @ts-check
import { execSync } from 'node:child_process';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

function getLastUpdated() {
    try {
        const gitDate = execSync('git log -1 --format=%cI').toString().trim();
        const date = new Date(gitDate);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
        });
    } catch {
        return '';
    }
}

// https://astro.build/config
export default defineConfig({
    site: 'https://myctrl.tools',
    output: 'static',
    adapter: cloudflare({
        imageService: 'compile',
        prerenderEnvironment: 'node',
    }),
    integrations: [
        react(),
        sitemap({
            filter: (page) => !page.includes('/api/'),
        }),
    ],

    // Performance optimizations
    build: {
        concurrency: 8,
        inlineStylesheets: 'auto',
    },

    vite: {
        plugins: [tailwindcss()],
        define: {
            __BUILD_LAST_UPDATED__: JSON.stringify(getLastUpdated()),
        },
        optimizeDeps: {
            exclude: [
                '@radix-ui/react-dialog',
                '@radix-ui/react-dropdown-menu',
                '@radix-ui/react-slot',
                'cmdk',
                'dexie',
            ],
        },
        ssr: {
            noExternal: ['lucide-react'],
        },
        build: {
            minify: 'esbuild',
            cssMinify: 'lightningcss',
        },
    },
});
