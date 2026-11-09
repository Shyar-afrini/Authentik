import path from "node:path";
import { fileURLToPath } from "node:url";

const authTarget = (process.env.AUTHENTIK_URL ?? "http://127.0.0.1:3005").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
export default {
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
  // The browser only talks to this origin; the auth server is proxied so its cookies stay first-party.
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${authTarget}/api/auth/:path*` },
      { source: "/api/nexus/:path*", destination: `${authTarget}/api/nexus/:path*` },
    ];
  },
};
