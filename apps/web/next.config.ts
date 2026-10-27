import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: [
    "@soryos/core",
    "@soryos/schema",
    "@soryos/bus",
    "@soryos/permissions",
    "@soryos/execution",
    "@soryos/tool",
    "@soryos/agent",
    "@soryos/cli",
    "@soryos/dev-runner",
    "@soryos/workspace",
    "@soryos/session",
    "@soryos/provider",
    "@soryos/filesystem",
    "@soryos/git",
    "@soryos/pty",
    "@soryos/config",
    "@soryos/auth",
    "@soryos/credentials",
    "@soryos/sandbox",
    "@soryos/terminal",
    "@soryos/github",
    "@soryos/voice",
    "@soryos/vision",
    "@soryos/images",
    "@soryos/plugin",
    "@soryos/theme",
  ],
  async redirects() {
    return [];
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        path: false,
        util: false,
        os: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
      };
    }
    return config;
  },
};

export default nextConfig;
