#!/usr/bin/env node
/**
 * Coleta opinioes reais sobre o DaVinci Resolve no Hacker News (API publica
 * do Algolia, sem login). Cada linha guardada e um comentario ou post real,
 * com o link original e o texto copiado.
 *
 * Regra do pacote replica: nada inventado. Se a API nao responder, o script
 * nao inventa linha nenhuma.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "replica", "reviews.csv");

const QUERIES = [
  '"DaVinci Resolve"',
  '"DaVinci Resolve" crash',
  '"DaVinci Resolve" render',
  '"DaVinci Resolve" proxy',
  '"DaVinci Resolve" GPU',
  '"DaVinci Resolve" install',
  '"DaVinci Resolve" learning curve',
  '"DaVinci Resolve" slow',
  '"DaVinci Resolve" memory',
  '"DaVinci Resolve" UI',
  '"DaVinci Resolve" Fusion',
  '"DaVinci Resolve" Fairlight',
];

const stripHtml = (text) =>
  text
    .replace(/<p>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();

async function search(query, tags, hitsPerPage = 100) {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=${tags}&hitsPerPage=${hitsPerPage}`;
  const res = await fetch(url, { headers: { "User-Agent": "corte-leve-research" } });
  if (!res.ok) throw new Error(`HN ${res.status} em ${query}`);
  const json = await res.json();
  return json.hits ?? [];
}

async function main() {
  const seen = new Set();
  const rows = [];

  for (const query of QUERIES) {
    for (const tags of ["comment", "story"]) {
      let hits = [];
      try {
        hits = await search(query, tags);
      } catch (err) {
        console.error(`  aviso: ${err.message}`);
        continue;
      }
      for (const hit of hits) {
        if (seen.has(hit.objectID)) continue;
        seen.add(hit.objectID);
        const raw = tags === "comment" ? hit.comment_text : hit.story_text;
        const text = stripHtml(raw ?? "");
        if (text.length < 120) continue;
        // só entra o que realmente fala do DaVinci Resolve: o Hacker News
        // tem muitos comentários com a palavra "resolve" fora do contexto
        if (!/davinci\s*resolve/i.test(text)) continue;
        const title = stripHtml(hit.title ?? hit.story_title ?? "");
        const url = hit.story_id
          ? `https://news.ycombinator.com/item?id=${hit.story_id}`
          : `https://news.ycombinator.com/item?id=${hit.objectID}`;
        const date = (hit.created_at ?? "").slice(0, 10);
        rows.push({ source: "hacker-news", url, date, rating: "", title, text });
      }
    }
  }

  if (!rows.length) {
    console.error("nenhuma review coletada - nada vai ser escrito");
    process.exit(1);
  }

  const escape = (value) => `"${String(value).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
  const csv = [
    "source,url,date,rating,title,text",
    ...rows.map((r) => [r.source, r.url, r.date, r.rating, r.title, r.text].map(escape).join(",")),
  ].join("\n");

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${csv}\n`, "utf8");
  console.log(`${rows.length} reviews em ${OUT}`);
}

main().catch((err) => {
  console.error(`coleta falhou: ${err.message}`);
  process.exit(1);
});
