import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/psicologo/sessão",
        destination: "/psicologo/sessao",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
