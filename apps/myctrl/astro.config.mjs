// @ts-check
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

/** @returns {string} */
function getOnnxRuntimeWebVersion() {
    const require = createRequire(import.meta.url);
    let dir = dirname(require.resolve('onnxruntime-web'));
    while (dir !== dirname(dir)) {
        const pkgPath = join(dir, 'package.json');
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
            if (pkg.name === 'onnxruntime-web' && typeof pkg.version === 'string') {
                return pkg.version;
            }
        }
        dir = dirname(dir);
    }
    throw new Error('Unable to resolve installed onnxruntime-web version');
}

const ORT_WASM_CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${getOnnxRuntimeWebVersion()}/dist/`;

/**
 * Prevent Vite from emitting onnxruntime-web's 25.6 MiB WASM binaries into
 * dist/client/_astro/ (Cloudflare Workers enforces a 25 MiB per-asset limit).
 * `@huggingface/transformers` already configures ONNX `wasmPaths` to jsDelivr
 * at runtime; rewriting `onnxruntime-web`'s static fallback `new URL("ort-wasm*.wasm",
 * import.meta.url)` expressions to the matching jsDelivr URL stops Vite from
 * copying the files into both the client and Web Worker bundles while keeping
 * fallback resolution valid.
 *
 * @returns {import('vite').Plugin}
 */
function externalizeOnnxWasmPlugin() {
    const pattern = /new URL\((["'])(ort-wasm[^"']+\.wasm)\1,\s*import\.meta\.url\)/g;
    return {
        name: 'externalize-onnx-wasm',
        enforce: 'pre',
        /**
         * @param {string} code
         * @param {string} id
         */
        transform(code, id) {
            if (!id.includes('onnxruntime-web') || !code.includes('ort-wasm')) {
                return null;
            }
            const replaced = code.replace(
                pattern,
                /**
                 * @param {string} _match
                 * @param {string} _quote
                 * @param {string} file
                 */
                (_match, _quote, file) => `new URL(${JSON.stringify(`${ORT_WASM_CDN_BASE}${file}`)})`,
            );
            return replaced === code ? null : { code: replaced, map: null };
        },
    };
}

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
    session: false,
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
        plugins: [tailwindcss(), externalizeOnnxWasmPlugin()],
        worker: {
            plugins: () => [externalizeOnnxWasmPlugin()],
        },
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
