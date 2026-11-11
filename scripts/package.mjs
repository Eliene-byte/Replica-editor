#!/usr/bin/env node
/**
 * Monta o pacote portátil: front + servidor + ffmpeg + atalhos.
 *
 *   node scripts/package.mjs win-x64
 *
 * Saída: release/corte-leve-<plataforma>.zip
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createZip, listFiles } from "./lib/zip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.argv[2] ?? "linux-x64";
const stage = path.join(root, "build", `corte-leve-${platform}`);
const releaseDir = path.join(root, "release");

const START_SH = `#!/bin/sh
# Corte Leve — sobe o editor local. Abra http://127.0.0.1:4321 no navegador.
cd "$(dirname "$0")"
PORT="\${PORT:-4321}" HOST="\${HOST:-127.0.0.1}" exec node server/index.js
`;

const START_CMD = `@echo off
REM Corte Leve - sobe o editor local. Abra http://127.0.0.1:4321 no navegador.
cd /d "%~dp0"
if "%PORT%"=="" set PORT=4321
if "%HOST%"=="" set HOST=127.0.0.1
node server\\index.js
`;

const README = `# Corte Leve

Editor de video leve, no navegador, para notebooks antigos.

## Como rodar

    ./start.sh          (linux/mac)
    start.cmd           (windows)

Depois abra http://127.0.0.1:4321 no navegador.

## O que tem aqui

    web/          interface (arquivos estaticos)
    server/       servidor local (Node.js 18+, zero dependencias)
    vendor/ffmpeg ffmpeg e ffprobe empacotados pelo CI

## Requisitos

Node.js 18 ou mais novo. Nada mais: o ffmpeg ja vem no pacote.

## Dados

Os projetos ficam na pasta "data/" ao lado do servidor (media, timeline, renders).
Apagar a pasta apaga tudo.
`;

async function main() {
  await fsp.rm(stage, { recursive: true, force: true });
  await fsp.mkdir(stage, { recursive: true });

  const copy = async (from, to) => {
    if (!fs.existsSync(from)) throw new Error(`faltando ${from} — rode "npm run build" antes`);
    await fsp.cp(from, to, { recursive: true });
  };

  await copy(path.join(root, "dist", "web"), path.join(stage, "web"));
  await copy(path.join(root, "dist", "server"), path.join(stage, "server"));

  const vendor = path.join(root, "vendor", "ffmpeg", platform);
  if (fs.existsSync(vendor)) {
    await copy(vendor, path.join(stage, "vendor", "ffmpeg", platform));
  } else {
    console.warn(`aviso: sem ffmpeg vendorizado para ${platform} (o app usa o ffmpeg do sistema)`);
  }

  await fsp.writeFile(path.join(stage, "start.sh"), START_SH, "utf8");
  await fsp.writeFile(path.join(stage, "start.cmd"), START_CMD, "utf8");
  await fsp.writeFile(path.join(stage, "README.md"), README, "utf8");
  await fsp.writeFile(path.join(stage, ".gitignore"), "data/\n", "utf8");

  const files = listFiles(stage);
  const zip = createZip(files, stage);
  await fsp.mkdir(releaseDir, { recursive: true });
  const zipPath = path.join(releaseDir, `corte-leve-${platform}.zip`);
  await fsp.writeFile(zipPath, zip);

  console.log(`pacote: ${zipPath} (${(zip.length / 1048576).toFixed(1)} MB, ${files.length} arquivos)`);
}

main().catch((err) => {
  console.error(`package: ${err.message}`);
  process.exit(1);
});
