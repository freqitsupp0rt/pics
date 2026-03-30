/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: {
    // enables the compiler
    enabled: true,

    // allow development requests from specific origins (e.g., Vercel, local proxies)
    allowedDevOrigins: [
      "http://localhost:3004",
      "http://127.0.0.1:3004",
      "https://pics.freqitsolutions.net"
    ],
  },
};

export default nextConfig;
