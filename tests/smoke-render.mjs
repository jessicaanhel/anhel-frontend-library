// Bundles the test files with esbuild (CSS modules via its "local-css"
// loader, like a real app's bundler would) and runs them in Node, one after
// the other:
//   tests/smoke.tsx            server-renders every component once
//   tests/server.ts            login, permissions, list handlers, helpers
//   tests/panel.ts             notes, accounts, trash, calendar feed and the other panel logic
//   tests/storage-contract.ts  the same storage contract on every backend
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";

const libraryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(libraryRoot, ".tmp", "smoke");
const testFiles = ["smoke.tsx", "server.ts", "panel.ts", "storage-contract.ts"];

await build({
  entryPoints: testFiles.map((file) => path.join(libraryRoot, "tests", file)),
  outdir: outDir,
  bundle: true,
  platform: "node",
  format: "esm",
  jsx: "automatic",
  // react, react-dom, framer-motion and the AWS SDK are loaded from
  // node_modules at run time instead of being bundled in.
  packages: "external",
  loader: { ".css": "local-css" },
  outExtension: { ".js": ".mjs" },
  logLevel: "warning",
});

for (const file of testFiles) {
  const outputName = file.replace(/\.tsx?$/, ".mjs");
  await import(pathToFileURL(path.join(outDir, outputName)).href);
}
