import { renderers } from './renderers.mjs';
import { c as createExports } from './chunks/entrypoint_BB22ujoB.mjs';
import { manifest } from './manifest_CagTJaQq.mjs';

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/auctions.astro.mjs');
const _page2 = () => import('./pages/index.astro.mjs');

const pageMap = new Map([
    ["../../node_modules/.pnpm/astro@4.16.19_@types+node@22.19.17_rollup@4.60.2_terser@5.46.2_typescript@5.9.3/node_modules/astro/dist/assets/endpoint/generic.js", _page0],
    ["src/pages/auctions.astro", _page1],
    ["src/pages/index.astro", _page2]
]);
const serverIslandMap = new Map();
const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "middlewareSecret": "5751e773-cdfb-446d-822d-ebeba22911ef",
    "skewProtection": false
};
const _exports = createExports(_manifest, _args);
const __astrojsSsrVirtualEntry = _exports.default;

export { __astrojsSsrVirtualEntry as default, pageMap };
