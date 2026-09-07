import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allows importing @mogd/* workspace packages as TS source without a
  // separate build step for each package.
  transpilePackages: ["@mogd/db", "@mogd/domain", "@mogd/shared", "@mogd/ui"],
  // @libsql/client's Node build pulls in native bindings via a dynamic
  // require plus README/LICENSE files webpack can't parse as modules.
  // Keep it (and its transitive libsql package) external instead of bundled.
  serverExternalPackages: ["@libsql/client", "libsql"],
  // serverExternalPackages alone doesn't stop webpack from statically
  // scanning libsql's native-binding loader, which does a
  // `require(dynamicExpr)` over its own directory — webpack turns that into
  // a "context module" covering every file next to it (READMEs, .d.ts,
  // platform .node binaries) and tries to parse each one as JS. Force the
  // whole libsql dependency tree external on the server so none of that is
  // ever bundled; @mogd/db calls require() for it at runtime instead.
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.(md|LICENSE)$/i,
      type: "asset/source",
    });
    if (isServer) {
      const existing = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existing,
        ({ request }: { request?: string }, callback: (err?: null, result?: string) => void) => {
          if (request && /^(@libsql\/|libsql$)/.test(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
