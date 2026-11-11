# Architecture: Replica Editor (rebuild of DaVinci Resolve's core editing loop)

Date: 2026-11-11 · Recon: `replica/recon.md` · Matriz: `replica/features.csv`

## Stack

| layer | choice | why |
| --- | --- | --- |
| web | TypeScript puro + esbuild, sem framework | O alvo é um notebook de 2010: bundle de ~120 KB gzip, zero runtime de framework, cold start instantâneo. React/Next custaria ~110 KB só de runtime e um build toolchain enorme. |
| rendering | Canvas 2D para a timeline, DOM só para painéis | Centenas de clipes em DOM matam máquina fraca; em canvas são milhares. |
| styling | CSS com custom properties (tokens), sem Tailwind | Tokens do `replica-design` entram direto no CSS; sem dependência de build e semPurgeCSS rodando no CI. |
| server | Node.js >= 18, HTTP puro, **zero dependências de runtime** | Um `node server.js` sobe tudo. Sem native modules = sem compilação local, sem dor no CI, sem ABI por plataforma. |
| database | JSON atômico por projeto (`projects/<id>/project.json`) | Ferramenta local de usuário único. Postgres seria absurdo aqui; SQLite exigiria native module (o que o CI teria que compilar por plataforma). JSON + rename atômico dá o mesmo isolamento, zero dependência. |
| auth | nenhum (bind em 127.0.0.1) | É um app desktop disfarçado de web. Sem rede = sem risco de exfazer o material do usuário. |
| payments / email | nenhum | Fora do slice (recon: S01-S10 não têm compra nem notificação). |
| jobs | fila de render in-process, 1 job por vez | 1 ffmpeg por vez é o que segura a CPU do notebook de 2010. Fila em memória, com estado persistido no job. |
| files | filesystem local: `projects/<id>/media/`, `cache/proxy/`, `renders/` | Mídia do usuário não sai da máquina. HTTP range requests para o `<video>` fazer streaming. |
| media / codec | ffmpeg (binário baixado pelo CI para `vendor/ffmpeg/<os>-<arch>/`) | O ffmpeg não fica no repositório (blob grande). O CI baixa, confere checksum e empacota no release; em dev, usa o `ffmpeg` do PATH. |
| hosting | processo local + release portátil por SO (zip) + imagem Docker opcional | Usuário baixa o zip, descompacta, roda. Sem custo, sem conta, funciona offline. |
| CI | GitHub Actions: baixa ffmpeg, compila tudo, roda testes, gera release | É o requisito: "baixar e compilar tudo" acontece no CI, não na máquina do usuário. |

**Regras não-negociáveis do alvo fraco**
- Bundle do front ≤ 150 KB gzip. Sem polling pesado, sem observers duplicados, sem framework.
- Timeline redesenha por *dirty flag* + `requestAnimationFrame`; nada de re-render por evento de mouse.
- Importação em streaming para o disco (nunca o arquivo inteiro em RAM) — 4 GB de vídeo não cabem nos 4 GB da máquina.
- Proxy automático (480p, CRF 28) para reprodução; o original só é aberto no export.
- Um ffmpeg por vez. Fila serial.

## Schema

Armazenamento: 1 arquivo JSON por projeto, escrito de forma atômica (`.tmp` + `rename`). SQLite opcional: DDL em `replica/schema.sql`.

Entidades: 11. Regras de acesso: checagem na camada de dados — cada rota resolve o `projectId` a partir do path e valida que existe no disco; nada de rede, nada de multiusuário, sem RLS (não há Postgres).

```jsonc
// projects/<id>/project.json
{
  "id": "prj_8f2c", "name": "Meu projeto", "createdAt": "2026-11-11T00:00:00Z",
  "updatedAt": "2026-11-11T00:00:00Z",
  "settings": { "fps": 30, "width": 1920, "height": 1080, "sampleRate": 48000,
                "proxyEnabled": true, "proxyScale": 4, "renderPath": "renders" },
  "media":    [ { "id": "med_1", "name": "a.mp4", "path": "media/a.mp4", "kind": "video",
                  "durationFrames": 450, "fps": 30, "width": 1920, "height": 1080,
                  "hasAudio": true, "thumb": "thumb/a.jpg", "proxy": "cache/proxy/a.mp4",
                  "status": "ready", "metadata": {} } ],
  "bins":     [ { "id": "bin_1", "name": "Roda", "parentId": null, "itemIds": ["med_1"] } ],
  "timelines":[ { "id": "tl_1", "name": "Timeline 1", "durationFrames": 900,
                  "tracks": [ { "id": "trk_v1", "kind": "video", "index": 1, "height": 72,
                               "muted": false, "solo": false, "locked": false, "name": "V1" } ],
                  "clips": [ { "id": "clp_1", "trackId": "trk_v1", "mediaId": "med_1",
                               "start": 0, "in": 0, "out": 450, "enabled": true,
                               "transform": { "x": 0, "y": 0, "scale": 1, "rotation": 0 },
                               "opacity": 1, "volume": 1, "speed": 1,
                               "color": { "lift": [0,0,0], "gamma": [0,0,0], "gain": [1,1,1],
                                          "temperature": 0, "tint": 0, "curve": null },
                               "keyframes": [ { "id": "kf_1", "property": "opacity",
                                               "time": 120, "value": 0.5, "easing": "linear" } ] } ],
                  "transitions": [], "markers": [ { "id": "mk_1", "time": 120,
                                                   "color": "#ffcc00", "label": "cena 2" } ] } ],
  "activeTimelineId": "tl_1"
}
```

Regras duras que viraram constraint no código (não só na UI):

- `clip.out > clip.in` e `clip.out - clip.in >= 1` — clip nunca tem duração zero.
- `clip.in >= 0` e `clip.out <= media.durationFrames` — não é possível trimar além da mídia.
- `clip.start >= 0` e não há sobreposição: dois clips da mesma faixa nunca ocupam o mesmo frame.
- `keyframe.time` dentro de `[clip.start, clip.start + dur]`.
- Toda posição é **frame inteiro**, nunca segundos em float: `frames = round(sec * fps)`. Float acumula erro e o ripple quebra o alinhamento.
- `mediaId` referenciado por um clip tem de existir em `project.media`; bin ids referenciados existem em `project.bins`.

## API

Todas as rotas locais, bind `127.0.0.1`. Sem webhook, sem e-mail, sem pagamento.

| method path | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| GET `/api/health` | estado do server + ffmpeg disponível/versão | local | — | `{ok, ffmpeg, version}` | — |
| GET `/api/projects` | lista projetos | local | — | `[{id,name,updatedAt,mediaCount}]` | F01 |
| POST `/api/projects` | cria projeto (nome, settings) | local | `{name, settings}` | `project` | F01 |
| GET `/api/projects/:id` | carrega projeto inteiro | local | — | `project` | F01, F10 |
| PATCH `/api/projects/:id` | salva estado do projeto (timeline, bins, settings) | local | `project` parcial | `{ok, updatedAt}` | F10 |
| DELETE `/api/projects/:id` | apaga projeto e mídia | local | — | `{ok}` | — |
| POST `/api/projects/:id/media` | importa mídia (multipart, streaming p/ disco) | local | arquivos | `[{mediaItem}]` | F02 |
| GET `/api/projects/:id/media/:mid/stream` | serve o original com HTTP Range | local | — | bytes | F03 |
| GET `/api/projects/:id/media/:mid/proxy` | serve o proxy com Range | local | — | bytes | F03 |
| GET `/api/projects/:id/media/:mid/thumb` | miniatura | local | — | jpeg | F02 |
| POST `/api/projects/:id/media/:mid/proxy` | (re)gerar proxy na hora | local | — | `{status}` | — |
| DELETE `/api/projects/:id/media/:mid` | remove mídia e clipes que a usam | local | — | `{ok}` | — |
| PATCH `/api/projects/:id/timeline/:tl` | salva timeline (clips, tracks, markers) | local | `timeline` | `{ok}` | F04-F08 |
| GET `/api/presets` | presets de export disponíveis | local | — | `[{id,label,args}]` | F09 |
| POST `/api/render` | enfileira render (idempotente por chave) | local | `{projectId, timelineId, presetId, out}` | `{job}` | F09 |
| GET `/api/render` | lista a fila | local | — | `[{job}]` | F09 |
| GET `/api/render/:jid` | status/progresso do job | local | — | `{job}` | F09 |
| DELETE `/api/render/:jid` | cancela o job | local | — | `{ok}` | F09 |
| GET `/api/render/:jid/file` | baixa o arquivo final | local | — | bytes | F09 |

Webhooks in: nenhum. Webhooks out: nenhum.
Jobs: `render` (fila serial, disparado por POST /api/render); `proxy` (gerado na importação, em background, com barra de progresso).

## The parts that bite

- **Fração de tempo:** tudo em frames inteiros. Timecode é derivado (`hh:mm:ss:ff`) só na exibição. Um `duration` em float derruba o ripple depois de 20 edições.
- **Idempotência:** `POST /api/render` recebe uma `key` (hash de timeline+preset+saída). Chave repetida devolve o job existente em vez de renderizar duas vezes. Importar o mesmo arquivo duas vezes não duplica: o hash do arquivo (sha1 do primeiro MB + tamanho) identifica e reaproveita.
- **Corridas:** escrita do `project.json` passa por uma fila por projeto (rename atômico, sem lockfile); dois abas no mesmo projeto → a segunda recebe 409 no save. Um render por vez na fila (sem isso, 2 ffmpeg simultâneos dobram o tempo em máquina fraca).
- **Limite de tamanho:** import default 4 GB, configurável; upload acima do limite é recusado *antes* de escrever; streaming direto pro disco com hash em paralelo.
- **Busca:** filtro do media pool é client-side — o projeto cabe em memória mesmo com 500 clipes (o JSON fica em ~200 KB).
- **Realtime:** não existe. App local, usuário único.
- **Offline:** funciona offline depois do primeiro start — ffmpeg vem no release (`vendor/`), mídia em disco.
- **Exclusão de dados:** apagar projeto apaga `projects/<id>` inteiro. Nenhum dado sai da máquina, então GDPR/LGPD é trivial: não há dado pessoal, só arquivo do usuário.
- **Dano ao usuário:** render falha → o arquivo de saída parcial é removido e o log fica no job. Import nunca sobrescreve mídia existente sem confirmação.
- **Cache de proxy:** proxy é regenerável; pode ser apagado a qualquer momento (`cache/`). Se sumir, o app regenera sob demanda.

## Build order

1. **Vertical slice (prova a stack):** S01 → S04 → S07. Importa 1 mp4, arrasta pra timeline, trim, export mp4.
   Rotas: `/api/projects*`, `/api/projects/:id/media`, `/api/projects/:id/media/:mid/stream`, `/api/render*`.
   Entidades: Project, MediaItem, Timeline, Track, TimelineClip, RenderJob.
2. **Must-haves**, por área:
   - media: import, bins, pool, thumbnails, busca (`S02`)
   - viewer: source viewer, in/out, transporte (`S04`)
   - edit: insert/append, ripple delete, trim, razor, mover, undo/redo, snapping, trim fino roll/slip/slide (`S04`)
   - timeline: multipista V/A, ruler, playhead, marcadores, waveform (`S04`)
   - inspector + keyframes + velocidade (`S04`)
   - playback: playhead da timeline, proxy (`S04`)
   - persistência: salvar/reabrir (`S01`)
   - deliver: preset + fila + log (`S07`)
   - ux: atalhos de teclado, undo/redo global (`todas`)
3. **Should-haves:** mix de áudio + VU (`S06`), color page com rodas e curvas (`S05`), transições, títulos, media inspector, trim numérico, settings, multi-seleção.
4. **Could-haves:** export de áudio, export de frame, timeline vertical, presets salvos, split-view, batch import, sync por waveform, últimos clipes.
5. **Fixes do replica-entrepreneur:** entram depois do `replica-entrepreneur` rodar.

**Ordem dentro do must:** cada fatia é implementada, testada e só então avança (mesma regra do FC27_ROADMAP).
