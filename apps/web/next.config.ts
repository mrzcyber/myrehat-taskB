import { varlockNextConfigPlugin } from "@varlock/nextjs-integration/plugin";

const withVarlock = varlockNextConfigPlugin();
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  output: "standalone",
  transpilePackages: ["shiki"],
  // Proxy auth + RPC to the server container so cookies stay first-party.
  async rewrites() {
    const serverUrl =
      process.env.NODE_ENV === "development" ? "http://localhost:3000" : "http://server:3000";
    return [
      { source: "/rpc/:path*", destination: `${serverUrl}/rpc/:path*` },
      { source: "/api/auth/:path*", destination: `${serverUrl}/api/auth/:path*` },
    ];
  },
};

export default withVarlock(nextConfig);
