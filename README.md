# Corte Leve

Editor de vídeo **no navegador**, para notebooks de 2010. Sem instalar nada, sem conta,
sem nuvem: você importa, corta na timeline e exporta em mp4.

Rebuild clean-room de um NLE profissional de pós-produção: reproduz funcionalidade e
padrão de UX, nunca código, logo, texto, asset ou API do original. O mapa de telas,
fluxos e modelo de dados está em `replica/recon.md`.

![paridade](https://img.shields.io/badge/paridade-69.8%2F100-c8f751) ![licença](https://img.shields.io/badge/licença-MIT-c8f751)

## Rodar em 30 segundos

```bash
npm ci
npm run build
node dist/server/index.js
# abre http://127.0.0.1:4321
```

Precisa de Node 18+. O ffmpeg é opcional em desenvolvimento (usa o do PATH);
no pacote released ele vem junto, baixado pelo CI com checksum fixado.

## Por que é leve

| | |
| --- | --- |
| front | 54 kB (≈15 kB gzip), TypeScript puro, sem framework |
| servidor | Node puro, **zero dependências de runtime** |
| dados | um JSON por projeto, escrito de forma atômica |
| mídia | fica no seu disco; o servidor roda em `127.0.0.1` |
| proxy | 480p gerado em background para o playback não travar |

## O que tem

- **Timeline** em canvas: corte, ripple delete, lâmina, ajuste fino (roll, slip, slide),
  encaixe automático, marcadores, múltiplas faixas de vídeo e áudio.
- **Inspector**: transform, opacidade, velocidade, volume, com keyframes e curva editável.
- **Cor** por clipe: elevação, ganho, saturação, temperatura, tinta.
- **Mixagem** por faixa: volume, panorâmica, mudo e solo.
- **Export**: mp4 (1080p/720p/480p), webm e wav, com fila, progresso, cancelamento e log.
- **Undo/redo** de 60 passos, autosave e atalhos de teclado (folha de atalhos no app).

## O que não tem (e por quê)

Composição 3D, tracking, cor com nodes, HDR por câmera, áudio imersivo,
colaboração em nuvem. O `replica/features.csv` diz onde cada coisa parou.

## Estrutura

```
apps/web/      interface (TypeScript + canvas)
apps/server/   servidor local (Node, zero dependência)
apps/shared/   tipos do projeto
replica/       o trabalho do pacote replica-skill: recon, arquitetura, design,
               matriz de features, research, marca, lançamento e preflight
tools/         ferramentas do pacote (paridade, varredura de marca, listagem)
scripts/       build, fetch do ffmpeg, empacotamento
site/          landing page (um arquivo HTML)
```

## Comandos

| comando | o que faz |
| --- | --- |
| `npm run dev` | front em watch + servidor |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | testes (node:test, sem framework) |
| `npm run build` | front + servidor em `dist/` |
| `node scripts/fetch-ffmpeg.mjs win-x64` | baixa o ffmpeg com verificação de sha256 |
| `node scripts/package.mjs win-x64` | monta o pacote portátil |
| `python tools/parity.py replica/features.csv` | nota de paridade contra o original |
| `python tools/sweep.py . --config replica/brand.json` | varredura de marca |

## CI

`.github/workflows/build.yml` é onde tudo acontece: testa, compila, baixa o ffmpeg
(com checksum), monta o zip por sistema e publica na Release do GitHub quando você
taggear `v*`.

## Licença

MIT. O binário do ffmpeg incluído no pacote é GPL — a redistribuição vem com
`THIRD_PARTY.md` pendente (ver `replica/deploy/preflight.md`).
