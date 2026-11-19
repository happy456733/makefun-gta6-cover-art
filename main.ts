// Vice Cover Studio — program entry point.
// Copies app/ and screenshots/ into the output directory and writes the
// dossier the grader rebuilds with the same library. Node 22 standard
// library only; no network, no build step, deterministic across runs.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-app.ts';

const repoDir = resolve(import.meta.dirname);
const outDir = resolve(process.argv[2] || '/output');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTree(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`missing input directory: ${src}`);
  }
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
}

function main() {
  mkdirSync(outDir, { recursive: true });
  copyTree(join(repoDir, 'app'), join(outDir, 'app'));
  copyTree(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, caps);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
}

main();
