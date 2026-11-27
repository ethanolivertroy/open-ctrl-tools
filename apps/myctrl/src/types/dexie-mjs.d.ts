// `db-runtime.ts` deep-imports `dexie/dist/dexie.mjs` to bypass Dexie's
// `import-wrapper.mjs` (which breaks default-export interop under Vite SSR).
// Dexie ships `dist/dexie.d.ts` but no `.d.mts` sibling for that path, so
// without this shim `Dexie` resolves to `any` and every store loses its types.
declare module 'dexie/dist/dexie.mjs' {
  export * from 'dexie';
  export { default } from 'dexie';
}
