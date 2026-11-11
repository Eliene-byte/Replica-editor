import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Extrator de .zip mínimo, sem dependência.
 * Só o que o CI precisa: guardar arquivos (stored) e deflate.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CD_SIGNATURE = 0x02014b50;
const LFH_SIGNATURE = 0x04034b50;

export function findEocd(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error("zip inválido: fim do diretório central não encontrado");
}

export function listEntries(buffer) {
  const eocd = findEocd(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(offset) !== CD_SIGNATURE) throw new Error("zip inválido: diretório central corrompido");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttrs = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.push({ name, method, compressedSize, localOffset, mode: (externalAttrs >>> 16) & 0xffff });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function extractZip(buffer, targetDir, filter) {
  const entries = listEntries(buffer);
  let count = 0;
  for (const entry of entries) {
    if (entry.name.endsWith("/")) continue;
    if (filter && !filter(entry.name)) continue;
    if (buffer.readUInt32LE(entry.localOffset) !== LFH_SIGNATURE) continue;
    const nameLength = buffer.readUInt16LE(entry.localOffset + 26);
    const extraLength = buffer.readUInt16LE(entry.localOffset + 28);
    const dataStart = entry.localOffset + 30 + nameLength + extraLength;
    const raw = buffer.subarray(dataStart, dataStart + entry.compressedSize);
    const data = entry.method === 0 ? raw : zlib.inflateRawSync(raw);
    const outPath = path.join(targetDir, entry.name);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, data);
    if (entry.mode & 0o111) {
      try {
        fs.chmodSync(outPath, 0o755);
      } catch {
        /* windows ignora permissões */
      }
    }
    count++;
  }
  return count;
}
