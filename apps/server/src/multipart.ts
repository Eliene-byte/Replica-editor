import fs from "node:fs";
import type { IncomingMessage } from "node:http";
import path from "node:path";

export interface MultipartFile {
  field: string;
  filename: string;
  contentType: string;
  path: string;
  size: number;
}

/**
 * Parser de multipart/form-data em streaming.
 *
 * Escrito à mão (sem dependência) porque o alvo é um app leve e o CI não deve
 * ter que compilar native modules. O corpo do arquivo vai direto para o disco:
 * um vídeo de 4 GB nunca cabe na RAM de um notebook de 2010.
 */
export async function parseMultipart(
  req: IncomingMessage,
  boundary: string,
  opts: { maxFileBytes: number; tmpDir: string; onFile: (file: MultipartFile) => Promise<string> }
): Promise<Record<string, string>> {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields: Record<string, string> = {};
  let buf = Buffer.alloc(0);
  let state: string = "preamble";
  const setState = (next: string): void => {
    state = next;
  };

  let current: { name: string; filename: string; contentType: string; stream: fs.WriteStream; size: number; path: string } | null = null;

  const closeCurrent = async () => {
    if (!current) return;
    const finished = current;
    current = null;
    await new Promise<void>((resolve, reject) =>
      finished.stream.end((err?: Error | null) => (err ? reject(err) : resolve()))
    );
    // o callback recebe o arquivo já fechado: ele pode renomear/provar/importar
    await opts.onFile({
      field: finished.name,
      filename: finished.filename,
      contentType: finished.contentType,
      path: finished.path,
      size: finished.size,
    });
  };

  const writeChunk = async (chunk: Buffer) => {
    if (!current || !chunk.length) return;
    current.size += chunk.length;
    if (current.size > opts.maxFileBytes) {
      throw new Error(`arquivo maior que o limite de ${opts.maxFileBytes} bytes`);
    }
    if (!current.stream.write(chunk)) {
      await new Promise<void>((resolve) => current!.stream.once("drain", resolve));
    }
  };

  try {
    for await (const chunk of req) {
      buf = Buffer.concat([buf, chunk as Buffer]);
      for (;;) {
        if (state === "done") break;
        if (state === "preamble") {
          const idx = buf.indexOf(delimiter);
          if (idx === -1) {
            // guarda a cauda: o delimitador pode estar cortado entre dois chunks
            const keep = delimiter.length - 1;
            if (buf.length > keep) buf = buf.subarray(buf.length - keep);
            break;
          }
          buf = buf.subarray(idx + delimiter.length);
          setState("firstHeaders");
          continue;
        }
        if (state === "firstHeaders") {
          if (buf.length < 2) break;
          if (buf.subarray(0, 2).toString() === "--") {
            setState("done");
            break;
          }
          if (buf.subarray(0, 2).toString() !== "\r\n") {
            throw new Error("multipart malformado: quebra de linha depois do delimitador");
          }
          buf = buf.subarray(2);
          setState("headers");
          continue;
        }
        if (state === "afterBody") {
          // depois do corpo, o buffer começa pelo delimitador
          if (buf.length < delimiter.length + 2) break;
          if (buf.subarray(0, delimiter.length).compare(delimiter) !== 0) {
            throw new Error("multipart malformado: delimitador não encontrado");
          }
          if (buf.subarray(delimiter.length, delimiter.length + 2).toString() === "--") {
            setState("done");
            break;
          }
          buf = buf.subarray(delimiter.length);
          setState("firstHeaders");
          continue;
        }
        if (state === "headers") {
          const idx = buf.indexOf("\r\n\r\n");
          if (idx === -1) break;
          const raw = buf.subarray(0, idx).toString("utf8");
          buf = buf.subarray(idx + 4);
          const name = /name="([^"]*)"/i.exec(raw)?.[1] ?? "file";
          const filename = /filename="([^"]*)"/i.exec(raw)?.[1] ?? "";
          const contentType = /content-type:\s*([^\r\n]+)/i.exec(raw)?.[1]?.trim() ?? "application/octet-stream";
          if (!filename) {
            // campo comum: o corpo é pequeno, mas por ora ignoramos o valor
            fields[name] = "";
            setState("body");
            current = null;
            continue;
          }
          const safe = path.basename(filename).replace(/[^\w.\-]+/g, "_") || "arquivo";
          const tmpPath = path.join(opts.tmpDir, `${Date.now()}-${Math.random().toString(16).slice(2)}-${safe}`);
          current = {
            name,
            filename: safe,
            contentType,
            stream: fs.createWriteStream(tmpPath),
            size: 0,
            path: tmpPath,
          };
          setState("body");
          continue;
        }
        // state === "body"
        const idx = buf.indexOf(delimiter);
        if (idx === -1) {
          // mantém a cauda para não perder o delimitador
          const keep = delimiter.length + 4;
          if (buf.length > keep) {
            await writeChunk(buf.subarray(0, buf.length - keep));
            buf = buf.subarray(buf.length - keep);
          }
          break;
        }
        await writeChunk(buf.subarray(0, Math.max(0, idx - 2)));
        await closeCurrent();
        buf = buf.subarray(idx);
        setState("afterBody");
      }
      if (state === "done") break;
    }
    await closeCurrent();
  } catch (err) {
    await closeCurrent().catch(() => undefined);
    throw err;
  }

  return fields;
}
