import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pdf-parse'],
};

module.exports = nextConfig;

export default nextConfig;
