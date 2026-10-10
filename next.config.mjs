/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The notification worker must never be cached, or phones keep an old copy.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
