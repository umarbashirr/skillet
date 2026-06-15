# nextjs.org doc map (for live fetch)

Fetch any page: `https://nextjs.org/docs/<path>`. Use these exact slugs with WebFetch, or pin
context7 `/vercel/next.js/v16.2.2`.

## Getting started (App) — `/docs/app/getting-started/<slug>`
installation · project-structure · layouts-and-pages · linking-and-navigating ·
server-and-client-components · fetching-data · mutating-data · caching · revalidating ·
error-handling · css · images · fonts · metadata-and-og-images · route-handlers · proxy ·
deploying · upgrading

## Guides (App) — `/docs/app/guides/<slug>`
ai-agents · analytics · authentication · backend-for-frontend · caching-without-cache-components ·
cdn-caching · ci-build-caching · content-security-policy · css-in-js · custom-server · data-security ·
debugging · deploying-to-platforms · draft-mode · environment-variables · forms ·
how-revalidation-works · incremental-static-regeneration · instrumentation · internationalization ·
json-ld · lazy-loading · local-development · mcp · mdx · memory-usage ·
migrating/{app-router-migration,from-create-react-app,from-vite} · migrating-to-cache-components ·
multi-tenant · multi-zones · open-telemetry · package-bundling · ppr-platform-guide · prefetching ·
preserving-ui-state · preventing-flash-before-hydration · production-checklist ·
progressive-web-apps · public-static-pages · redirecting · rendering-philosophy · sass · scripts ·
self-hosting · single-page-applications · static-exports · streaming · tailwind-v3-css ·
testing/{cypress,jest,playwright,vitest} · third-party-libraries ·
upgrading/{codemods,version-14,version-15,version-16} · videos · view-transitions

## API reference — `/docs/app/api-reference/<...>`
- **directives/**: use-cache · use-cache-private · use-cache-remote · use-client · use-server
- **components/**: font · form · image · link · script
- **file-conventions/**: default · dynamic-routes · error · forbidden · instrumentation ·
  instrumentation-client · intercepting-routes · layout · loading · mdx-components · not-found ·
  page · parallel-routes · proxy · public-folder · route · route-groups · route-segment-config ·
  src-folder · template · unauthorized · metadata/{app-icons,manifest,opengraph-image,robots,sitemap}
- **functions/**: after · cacheLife · cacheTag · catchError · connection · cookies · draft-mode ·
  fetch · forbidden · generate-image-metadata · generate-metadata · generate-sitemaps ·
  generate-static-params · generate-viewport · headers · image-response · next-request ·
  next-response · not-found · permanentRedirect · redirect · refresh · revalidatePath ·
  revalidateTag · unauthorized · unstable_cache · unstable_noStore · unstable_rethrow · updateTag ·
  use-link-status · use-params · use-pathname · use-report-web-vitals · use-router ·
  use-search-params · use-selected-layout-segment(s) · userAgent
- **config/**: `next-config-js/<option>` (adapterPath, allowedDevOrigins, assetPrefix,
  authInterrupts, basePath, cacheComponents, cacheHandlers, cacheLife, compress, cssChunking,
  deploymentId, devIndicators, distDir, env, expireTime, generateBuildId, headers, htmlLimitedBots,
  images, inlineCss, logging, optimizePackageImports, output, pageExtensions,
  productionBrowserSourceMaps, proxyClientMaxBodySize, reactCompiler, reactStrictMode, redirects,
  rewrites, sassOptions, serverActions, serverComponentsHmrCache, serverExternalPackages,
  staleTimes, taint, trailingSlash, transpilePackages, turbopack, turbopackFileSystemCache,
  typedRoutes, typescript, urlImports, viewTransition, webpack, webVitalsAttribution …) ·
  config/typescript · config/eslint
- **cli/**: create-next-app · next
- **adapters/**: configuration · creating-an-adapter · api-reference · testing-adapters ·
  routing-with-next-routing · implementing-ppr-in-an-adapter · runtime-integration ·
  invoking-entrypoints · output-types · routing-information · use-cases
- **edge** · **turbopack** · **/docs/app/glossary**

## Pages Router (legacy) — `/docs/pages/<...>`
getting-started/* · guides/* · building-your-application/{routing,rendering,data-fetching,configuring}/* ·
api-reference/{components,file-conventions,functions,config,cli,adapters,edge,turbopack}/*

## Architecture / Community
`/docs/architecture/{accessibility,fast-refresh,nextjs-compiler,supported-browsers}` ·
`/docs/community/{contribution-guide,rspack}`
