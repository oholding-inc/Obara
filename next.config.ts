import path from "node:path";
import type { NextConfig } from "next";

// Racine explicite : un package-lock.json dans le dossier utilisateur fait sinon
// choisir la mauvaise racine de workspace à Turbopack et au traçage des fichiers.
const racine = path.resolve(__dirname);

const nextConfig: NextConfig = {
  turbopack: { root: racine },
  outputFileTracingRoot: racine,
};

export default nextConfig;
