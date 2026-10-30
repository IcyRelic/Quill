import type { NextConfig } from "next";

// Serve Quill under a sub-path, such as /docs, by setting QUILL_BASE_PATH when building. Empty means the root.
const basePath = (process.env.QUILL_BASE_PATH ?? "").trim().replace(/\/+$/, "").replace(/^(?=[^/])/, "/");

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_QUILL_BASE_PATH: basePath },
  // Content lives on disk (content/ by default) and is read at request time.
  outputFileTracingExcludes: { "*": ["./content/**/*"] },
};

export default nextConfig;
