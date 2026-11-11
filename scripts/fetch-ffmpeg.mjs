#!/usr/bin/env node
/**
 * Baixa o ffmpeg/ffprobe do CI e deixa em vendor/ffmpeg/<plataforma>/.
 *
 * Por que no CI e não no repositório: binário de 150 MB não versiona.
 * Por que com checksum: binário que muda sozinho é binário que alguém
 * trocou. Se o sha256 não bater, a build falha e alguém tem que olhar.
 *
 *   node scripts/fetch-ffmpeg.mjs            # plataforma atual
 *   node scripts/fetch-ffmpeg.mjs linux-x64  # outra plataforma
 */

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { extractZip } from "./lib/unzip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const versionsPath = path.join(root, "vendor", "ffmpeg", "versions.json");

function currentPlatform() {
  const platform = process.platform === "win32" ? "win" : process.platform === "darwin" ? "darwin" : "linux";
  const arch = process.arch === "x64" ? "x64" : "arm64";
  return `${platform}-${arch}`;
}

async function sha256(file) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: "inherit", windowsHide: true });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} saiu com ${code}`))));
  });
}

async function download(url, dest) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`download falhou (${response.status}) em ${url}`);
  const total = Number(response.headers.get("content-length") ?? 0);
  let received = 0;
  let lastLog = 0;
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const handle = await fsp.open(dest, "w");
  try {
    for await (const chunk of response.body) {
      await handle.write(chunk);
      received += chunk.length;
      if (total && Date.now() - lastLog > 5000) {
        lastLog = Date.now();
        process.stdout.write(`  ${(received / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB\n`);
      }
    }
  } finally {
    await handle.close();
  }
  return dest;
}

async function main() {
  const platform = process.argv[2] ?? currentPlatform();
  const versions = JSON.parse(await fsp.readFile(versionsPath, "utf8"));
  const spec = versions.platforms[platform];
  if (!spec) {
    throw new Error(`plataforma desconhecida: ${platform}. disponíveis: ${Object.keys(versions.platforms).join(", ")}`);
  }

  const outDir = path.join(root, "vendor", "ffmpeg", platform);
  const targetFfmpeg = path.join(outDir, process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
  if (fs.existsSync(targetFfmpeg)) {
    console.log(`ffmpeg já está em ${outDir} — nada a fazer`);
    return;
  }

  if (spec.type === "brew") {
    console.log(`macOS: o CI instala com brew (${spec.note})`);
    return;
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "replica-ffmpeg-"));
  const archive = path.join(tmpDir, spec.type === "zip" ? "ffmpeg.zip" : "ffmpeg.tar.xz");

  console.log(`baixando ${spec.url}`);
  await download(spec.url, archive);

  const digest = await sha256(archive);
  if (spec.sha256 && digest !== spec.sha256) {
    throw new Error(
      `checksum não bate para ${platform}\n  esperado: ${spec.sha256}\n  obtido:   ${digest}\n` +
        `Se a mudança for legítima, atualize vendor/ffmpeg/versions.json.`
    );
  }
  if (!spec.sha256) console.warn(`  (sem checksum fixado para ${platform}: ${digest})`);

  const extractDir = path.join(tmpDir, "extract");
  await fsp.mkdir(extractDir, { recursive: true });
  if (spec.type === "zip") {
    const buffer = await fsp.readFile(archive);
    const count = extractZip(buffer, extractDir);
    console.log(`  extraídos ${count} arquivos`);
  } else {
    await run("tar", ["-xf", archive, "-C", extractDir]);
    console.log("  extraído com tar");
  }

  await fsp.mkdir(outDir, { recursive: true });
  for (const relative of spec.binaries) {
    const source = path.join(extractDir, relative);
    const dest = path.join(outDir, path.basename(relative));
    if (!fs.existsSync(source)) throw new Error(`binário não encontrado no pacote: ${relative}`);
    await fsp.copyFile(source, dest);
    if (process.platform !== "win32") await fsp.chmod(dest, 0o755);
    console.log(`  ${path.basename(relative)} -> ${dest}`);
  }

  await fsp.rm(tmpDir, { recursive: true, force: true });
  console.log(`ffmpeg pronto em ${outDir}`);
}

main().catch((err) => {
  console.error(`fetch-ffmpeg: ${err.message}`);
  process.exit(1);
});
