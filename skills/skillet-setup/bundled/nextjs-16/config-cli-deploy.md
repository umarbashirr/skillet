# next.config, CLI, Turbopack, Adapters & deployment

## next.config (`next.config.ts` | `.js` | `.mjs`)
Can be an object or a `(phase, { defaultConfig }) => config` function (phases from `next/constants`).
Common options:
- **Caching/rendering:** `cacheComponents`, `cacheLife`, `cacheHandlers`, `staleTimes`, `expireTime`,
  `serverComponentsHmrCache`, `cacheHandler` + `cacheMaxMemorySize`.
- **Routing/network:** `basePath`, `assetPrefix`, `trailingSlash`, async `redirects`/`rewrites`/
  `headers`, `proxyClientMaxBodySize`.
- **Build/bundle:** `output:'standalone'`, `serverExternalPackages`, `transpilePackages`,
  `optimizePackageImports`, `turbopack`, `webpack` (webpack mode only), `productionBrowserSourceMaps`,
  `distDir`, `pageExtensions`, `generateBuildId`, `deploymentId`.
- **DX/types:** `typedRoutes`, `typescript` (`tsconfigPath`, `ignoreBuildErrors`), `reactStrictMode`,
  `reactCompiler`, `logging`, `devIndicators`, `allowedDevOrigins`.
- **Features:** `images`, `env`, `taint`, `viewTransition`, `experimental.authInterrupts`,
  `sassOptions`, `serverActions`.

`images`: `remotePatterns` (use this, not deprecated `domains`), `localPatterns` (incl. `search` for
query strings), `qualities`, `imageSizes`/`deviceSizes`, `formats`, `minimumCacheTTL`,
`maximumRedirects`, `dangerouslyAllowLocalIP`, `loader`/`loaderFile`, `unoptimized`.

## CLI
- `next dev [--webpack] [-p <port>] [-H <host>] [--experimental-https]` → outputs to `.next/dev`.
- `next build [--webpack] [-d] [--no-lint] [--debug-prerender] [--debug-build-paths <glob>]`.
- `next start [-p] [-H] [--keepAliveTimeout <ms>]`.
- `next info` · `next typegen` (route types without full build) · `next upgrade [--revision <v>]` ·
  `next experimental-analyze` (Turbopack bundle UI) · `next telemetry`.
- `create-next-app@latest [name]` flags: `--ts/--js`, `--tailwind`, `--eslint/--biome/--no-linter`,
  `--app/--api`, `--src-dir`, `--turbopack/--webpack`, `--import-alias <a>`, `--empty`,
  `--use-npm|pnpm|yarn|bun`, `-e <example>`, `--skip-install`, `--disable-git`, `--yes`.

## Turbopack (default bundler)
Config under top-level `turbopack`: `root`, `rules` (loader map per glob), `resolveAlias`,
`resolveExtensions`. Falls back to SWC/WASM on unsupported platforms; opt into webpack with
`--webpack`.
- Supported: TS/JSX, ESM+CJS, RSC, Fast Refresh, global CSS, CSS Modules, PostCSS, Sass/SCSS,
  Lightning CSS nesting, tsconfig path aliases, common webpack loaders (core API).
- Gaps vs webpack: no webpack plugins, no `~`-prefixed Sass node_modules imports (use
  `resolveAlias`), no custom Sass functions; CSS-module order follows JS import order. A `webpack()`
  config without `--webpack` fails the build.

## Adapters
`adapterPath` points at `{ name, modifyConfig(config, { phase, nextVersion }), onBuildComplete(ctx) }`.
`onBuildComplete` exposes the routing table (beforeFiles/afterFiles/dynamic/fallback/rsc) and outputs
(pages/appPages/appRoutes/prerenders/staticFiles + buildId/distDir) — use it to emit platform-specific
artifacts. See `/docs/app/api-reference/adapters/*`.

## Deployment & self-hosting
- Single Node server via `next start`; `output:'standalone'` for slim images; add `sharp` for image
  optimization. Streaming must be end-to-end for PPR/RSC/Server Actions (disable proxy buffering:
  `X-Accel-Buffering: no`).
- **Multi-instance:** identical `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, stable `generateBuildId` /
  `deploymentId` (version-skew protection), shared `cacheHandler` + `cacheHandlers` (Redis/KV) with
  `cacheMaxMemorySize: 0`. Custom cache handler implements `get/set/revalidateTag` (+
  `updateTags`/`refreshTags` for tag coordination).
- ESLint/types run **outside** `next build` now — wire `eslint` + `tsc --noEmit` (or `next typegen &&
  tsc`) into CI. Production checklist: `/docs/app/guides/production-checklist`.
- Verified platform adapters: Vercel, Netlify, AWS Amplify, Azure, Cloudflare, Railway, Render,
  Fly.io, … (`/docs/app/getting-started/deploying`).
