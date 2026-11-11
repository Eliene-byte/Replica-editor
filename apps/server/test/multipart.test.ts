import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { parseMultipart } from "../src/multipart.ts";

function multipartBody(boundary: string, parts: Array<{ name: string; filename?: string; content: string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\nContent-Type: application/octet-stream\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n`;
    chunks.push(Buffer.from(`${disposition}\r\n`));
    chunks.push(Buffer.from(part.content));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

test("o parser de multipart extrai o arquivo para o disco", async () => {
  const boundary = "----replicateste123";
  const body = multipartBody(boundary, [
    { name: "file", filename: "video.mp4", content: "conteudo de teste do video" },
  ]);

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "replica-mp-"));
  const received: Array<{ name: string; filename: string; path: string; size: number }> = [];

  const req = Readable.from([body.subarray(0, 17), body.subarray(17)]) as unknown as Parameters<typeof parseMultipart>[0];
  await parseMultipart(req, boundary, {
    maxFileBytes: 1024 * 1024,
    tmpDir,
    onFile: async (file) => {
      received.push({ name: file.field, filename: file.filename, path: file.path, size: file.size });
      return file.path;
    },
  });

  assert.equal(received.length, 1);
  assert.equal(received[0].filename, "video.mp4");
  assert.equal(received[0].size, "conteudo de teste do video".length);
  const written = await fs.readFile(received[0].path, "utf8");
  assert.equal(written, "conteudo de teste do video");
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("o parser recusa arquivo acima do limite", async () => {
  const boundary = "----replicateste456";
  const body = multipartBody(boundary, [{ name: "file", filename: "grande.mp4", content: "x".repeat(5000) }]);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "replica-mp-"));
  const req = Readable.from([body]) as unknown as Parameters<typeof parseMultipart>[0];
  await assert.rejects(
    () =>
      parseMultipart(req, boundary, {
        maxFileBytes: 100,
        tmpDir,
        onFile: async (file) => file.path,
      }),
    /limite/
  );
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test("dois arquivos no mesmo envio são separados", async () => {
  const boundary = "----replicateste789";
  const body = multipartBody(boundary, [
    { name: "file", filename: "a.mp4", content: "AAA" },
    { name: "file", filename: "b.mp4", content: "BBBB" },
  ]);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "replica-mp-"));
  const contents: string[] = [];
  const req = Readable.from([body]) as unknown as Parameters<typeof parseMultipart>[0];
  await parseMultipart(req, boundary, {
    maxFileBytes: 1024 * 1024,
    tmpDir,
    onFile: async (file) => {
      contents.push(await fs.readFile(file.path, "utf8"));
      return file.path;
    },
  });
  assert.deepEqual(contents, ["AAA", "BBBB"]);
  await fs.rm(tmpDir, { recursive: true, force: true });
});
