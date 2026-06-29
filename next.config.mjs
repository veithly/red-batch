/** @type {import('next').NextConfig} */
const nextConfig = {
  // node: builtins (node:sqlite) are externalized by default on the server runtime.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
