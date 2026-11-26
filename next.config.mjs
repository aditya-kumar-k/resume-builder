/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker uses "standalone"; Cloudflare Pages builds a static site with STATIC_EXPORT=1.
  output: process.env.STATIC_EXPORT ? "export" : "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};
export default nextConfig;
