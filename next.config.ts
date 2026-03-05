import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "pdf-parse",
    "sharp",
  ],
};

export default nextConfig;
