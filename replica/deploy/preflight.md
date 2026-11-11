# replica-deploy — preflight e publicação

Date: 2026-11-11 · Marca: `replica/brand.json` · Listagem: `replica/launch/listing.json`

Este app **não tem servidor de produção**: ele roda na máquina de quem usa. O
"deploy" aqui é (a) publicar o pacote portátil e (b) publicar a landing page.

## Portão de preflight

Cada item é um comando. Se algum falhar, não publica.

| # | checagem | comando | estado em 2026-11-11 |
| --- | --- | --- | --- |
| 1 | tipos | `npm run typecheck` | **ok** |
| 2 | testes | `npm test` | **ok** — 26 testes, 0 falhas |
| 3 | build | `npm run build` | **ok** — front 54,4 kB (≈15 kB gzip) |
| 4 | paridade (must-haves) | `python tools/parity.py replica/features.csv` | **parcial** — 18 de 24 must-haves; 6 em aberto |
| 5 | varredura de marca | `python tools/sweep.py . --config replica/brand.json` | **limpo** |
| 6 | contraste dos tokens | `python tools/contrast.py replica/design/tokens.json` | **ok** — 26 pares, 0 falhas AA |
| 7 | listagem de loja | `python tools/listing.py replica/launch/listing.json` | **ok** — 0 erros, 0 avisos |
| 8 | binário do ffmpeg com checksum | `node scripts/fetch-ffmpeg.mjs linux-x64` | **ok no CI** (sha256 fixado em `vendor/ffmpeg/versions.json`) |
| 9 | render real ponta a ponta | importar → timeline → `POST /api/render` | **ok** — mp4 854×480, 6 s, h264+aac, 113 KB |

O item 4 é o que trava. Os 6 *must-haves* abertos:

- trim fino nos modos roll, slip e slide → **implementado**, mas ainda não
  creditado na matriz (falta o teste de interação que prove na UI)
- keyframes com curva editável → **implementado**, falta crédito
- media pool em modo lista → **implementado**, falta crédito
- bins com subpastas e mover mídia → **implementado** (criar bin e mover item),
  falta crédito; subpasta aninhada segue aberta
- reprodução simultânea de várias faixas → **aberta de verdade**
- barra de busca visual no visualizador → **implementado** (scrub), falta crédito

Atualizar `replica/features.csv` depois de testar na mão, não antes.

## Publicação

### Pacote portátil (o produto)

O CI (`/.github/workflows/build.yml`) faz tudo:

1. `check`: tipos, testes, build, paridade e varredura de marca.
2. `vendor`: baixa o ffmpeg do build fixado (`autobuild-2026-11-11-12-39`),
   confere o sha256 e guarda o binário como artefato. macOS usa `brew`.
3. `package`: monta `corte-leve-<plataforma>.zip` — front, servidor,
   `vendor/ffmpeg`, `start.sh`/`start.cmd` e o README do pacote.
4. `release`: em tag `v*`, publica os zips na Release do GitHub.

```bash
# local, para testar antes de tagar
npm run build
node scripts/fetch-ffmpeg.mjs win-x64
node scripts/package.mjs win-x64
```

### Landing page

`site/index.html` é um arquivo só. Pode ir para GitHub Pages, Netlify, ou
qualquer host estático. Sem analytics, sem cookie, sem CDN.

### DNS

Nada a configurar: o app não usa domínio. A landing page usa o domínio do
GitHub Pages (`<usuario>.github.io`) ou o que for registrado depois da busca
de marca (as marcas ainda estão "a rodar" em `replica/brand.md`).

### Variáveis de ambiente

| variável | padrão | para quê |
| --- | --- | --- |
| `PORT` | `4321` | porta do servidor local |
| `HOST` | `127.0.0.1` | deixe como está; mudar expõe a rede local |
| `REPLICA_DATA_DIR` | `<repo>/data` | onde ficam projetos, mídia, proxies e renders |
| `REPLICA_FFMPEG` | — | caminho do ffmpeg (senão usa `vendor/ffmpeg/` ou o do PATH) |
| `REPLICA_MAX_FILE_BYTES` | `4 GB` | limite de importação |

Sem segredos, sem chave de API, sem conta de terceiros. É o ponto do produto.

### Monitoramento

O app local não tem telemetria (e não deve: ver `replica/entrepreneur.md`).
Sinais de saúde que o usuário mesmo pode ver:

- `GET /api/health` → `{ok, ffmpeg, ffmpegVersion, node}`
- a tela de exportação mostra o log do ffmpeg quando algo falha
- `data/` é a única pasta a fazer backup

### App móvel

Fora de escopo: o produto é desktop-local. O que existe para o futuro é
descrever o fluxo de "encapsular em WebView" — mas isso contradiz a promessa
de "roda na sua máquina", então fica para depois.

### Legal

- Licença MIT no repositório.
- O ffmpeg é GPL (build "gpl" da BtbN). O pacote portable **inclui** o binário:
  quem distribuir esse zip distribui GPL. Manter o build GPL e não linkar
  estaticamente em código proprietário (o servidor é Node separado, sem link).
- `LICENSE` e `THIRD_PARTY.md` (ffmpeg) precisam estar no zip do pacote
  antes da primeira release pública. **Pendência.**
- O app não usa素材, áudio, fonte ou código da Blackmagic Design.
