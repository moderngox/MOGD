import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mogd/db", "@mogd/domain", "@mogd/media", "@mogd/shared", "@mogd/ui"],
  // See apps/web/next.config.ts for the full explanation of why both the
  // serverExternalPackages entry and the webpack() override below are
  // needed for libsql's native-binding loader to build cleanly.
  serverExternalPackages: ["@libsql/client", "libsql"],
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
