// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
//
// Nitro build target: defaults to Cloudflare Workers (cloudflare-module), which is what
// the Lovable sandbox always forces regardless of this setting. Outside the sandbox (e.g. a
// real `vite build` run by a host's CI), Vercel sets its own `VERCEL` env var during builds —
// detect that and switch the Nitro preset to "vercel" automatically, so the exact same repo
// deploys correctly on either platform with zero manual config. Everything else (local dev,
// Cloudflare deploys) is unaffected since VERCEL is unset there.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  nitro: process.env.VERCEL ? { preset: "vercel" } : undefined,
});
