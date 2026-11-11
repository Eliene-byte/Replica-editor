# Recon map: DaVinci Resolve 21 (desktop: Windows / macOS / Linux)

Scope: o loop central de edição — importar mídia, cortar na timeline, ajustar propriedades e áudio, e exportar. Fora do slice: Fusion (composição nodal), multicâmera, collaboration/BYOK, RAW e color management avançado, Atmos, painéis de hardware.
For: o próprio usuário — um NLE de navegador que roda em notebook de 2010 (2–4 GB RAM, GPU fraca, SSD lento), com o GitHub Actions baixando e compilando tudo (ffmpeg, binário do servidor, bundle do front).
Date: 2026-11-11

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Página oficial do produto (Features) | https://www.blackmagicdesign.com/products/davinciresolve/features | Define as "pages" (Media, Cut, Edit, Fusion, Color, Fairlight, Deliver) e o que cada uma faz. Fonte primária da estrutura de navegação. |
| 2 | Página oficial — Edit | https://www.blackmagicdesign.com/products/davinciresolve/edit | Drag-and-drop, trimming contextual, atalhos customizáveis, biblioteca de titles/transitions/effects, proxies, timeline vertical, keyframe editor, legendas. |
| 3 | Página oficial — Cut | https://www.blackmagicdesign.com/products/davinciresolve/cut | Source tape, dual timelines, source overwrite, sync bin, smart editing, tudo orientado a ação (cada clique faz algo). |
| 4 | Página oficial — Color | https://www.blackmagicdesign.com/products/davinciresolve/color | Sliders primários, secundários, PowerWindows, qualifiers, tracking, HDR, node editor, Resolve FX. |
| 5 | Página oficial — Fairlight | https://www.blackmagicdesign.com/products/davinciresolve/fairlight | Nó de áudio, EQ, dinâmica, ADR/Foley, elastic audio, Voice Isolation, mix 2.000 trilhas, buses. |
| 6 | Página oficial — Fusion | https://www.blackmagicdesign.com/products/davinciresolve/fusion | Fluxo nodal, tracking, keying, 3D, partículas, motion graphics. |
| 7 | Página oficial — Media/Delivery | https://www.blackmagicdesign.com/products/davinciresolve/media | Import, sync A/V automático, bins, metadata, render queue, presets de encode, upload. |
| 8 | Treinamento oficial (currículo) | https://www.blackmagicdesign.com/products/davinciresolve/training | Lista as aulas públicas: trim edit, match frame, replace shots, mix audio, effects/transitions/titles, travelling mattes, green screen key, color/scopes/node editor, presets + render queue, color management, Fairlight (levels, spotting list, sound library, panning, EQ, dynamics, buses, automation, VO/ADR, track layers, channel mapping), Fusion (nodes, compositing, tracking, keying). Usado como fonte para a matriz de features. |
| 9 | Manual oficial (referência) | https://documents.blackmagicdesign.com/UserManuals/DaVinci-Resolve-18-Definitive-Guide.pdf | Documento público de treinamento; usado como referência de nomenclatura de comandos e painéis. |
| 10 | Comparativo oficial Resolve x Premiere x FCP | https://www.blackmagicdesign.com/products/davinciresolve | Tabela "Free vs Studio" delimita o que é free: 8-bit até 60 fps, até 3840×2160; Studio adds Neural Engine, 10-bit 120 fps, magic mask, text-based editing, etc. Define o que o clone precisa e o que é "o que o app possui". |
| 11 | Comparativo deributo/capacidade (resumo técnico) | https://www.blackmagicdesign.com/products/davinciresolve/techspecs | Requisitos de sistema: ponto de corte de hardware → dimensiona a meta "notebook de 2010". |

Clean-room: nada de código, binário, asset ou texto da Blackmagic foi copiado. Só o comportamento público (nomes de função,layout, fluxo) foi estudado. Nenhum asset do original entra no clone.

## Core loop

Importar um vídeo, cortá-lo numa timeline multipista com trim preciso, ajustar o que importa (transform, opacidade, cor, volume) e exportar um arquivo final — sem sair do navegador e sem pedir 8 GB de RAM.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Project Manager | `/` | abrir/criar projeto, projetos recentes, config global | ProjectCard, NewProjectDialog, RecentList | empty (sem projeto), list, error (projeto corrompido) |
| S02 | Media | `/m` | importar, organizar em bins, ver metadados, sync de áudio | BinTree, MediaGrid, ImportDropzone, MediaInspector | empty, importing (progresso), filled, error (codec não suportado) |
| S03 | Cut | `/c` | corte rápido: source tape + timeline compacto | SourceTape, CompactTimeline, TransportBar, SyncBin | empty (sem mídia), filled, loading (proxy) |
| S04 | Edit | `/e` | montagem principal: pool, viewers, inspector, timeline | MediaPool, SourceViewer, TimelineViewer, Inspector, Timeline, Toolbar, EffectsPanel | empty, filled, clip selecionado, dragging, read-only (trim) |
| S05 | Color | `/col` | correção de cor por clipe e por nó | ColorViewer, NodeGraph (simplificado), PrimaryWheels, Curves, Scopes | empty (nenhum clip), filled, sem clip na playhead |
| S06 | Fairlight | `/f` | mixagem de áudio | Mixer, ChannelStrip, Waveform, LevelFaders, Meters | empty, filled, clip em solo, sem áudio no clip |
| S07 | Deliver | `/d` | exportar | PresetList, RenderQueue, RenderProgress, OutputPicker | empty, queued, rendering, done, failed (log de erro) |
| S08 | Settings | `/settings` (modal global) | fps, resolução, proxy, caminho de render, atalhos | SettingsForm, Toggle, NumberField, PathPicker | default, dirty, saved |
| S09 | Help / Atalhos | overlay em qualquer tela | mapa de atalhos de teclado | ShortcutSheet | open, closed |
| S10 | Import Progress | overlay em S02 | progresso de import/cópia/proxy | ProgressBar, ProgressList | running, done, error |

## Flows

```
F01 Criar/abrir projeto
    S01 -> (novo) -> S04
    happy path clicks: 3
    edge: projeto existente com mídia ausente; nome duplicado; projeto corrompido (JSON inválido) -> erro e oferecer reset

F02 Importar mídia
    S02 -> S10 -> S02
    happy path clicks: 4 (arrastar arquivo, esperar, abrir bin)
    edge: codec não suportado; arquivo > 2 GB; disco cheio; nome duplicado; mídia sem áudio

F03 Pré-visualizar source e marcar in/out
    S04 -> SourceViewer -> (marcar in/out)
    happy path clicks: 2 (clique no clip, tecla I/O)
    edge: clip sem vídeo (áudio); proxy ainda não pronto; clipe em falta no disco

F04 Montar o corte (insert/append + ripple delete)
    S04 -> MediaPool -> Timeline
    happy path clicks: 3 (arrastar clip do pool para a timeline)
    edge: colar em faixa vazia; ripple delete com clip seguinte; desfazer (Ctrl+Z) em cadeia

F05 Trim fino (roll, slip, slide)
    S04 -> TrimMode (no editor, sem sair da tela)
    happy path clicks: 2 (selecionar modo, arrastar borda)
    edge: trim quecollapsed clip a zero; trim além da duração da mídia; trim em transição

F06 Ajustar propriedades do clip (transform, opacidade, velocidade)
    S04 -> Inspector -> (keyframes)
    happy path clicks: 3
    edge: valor fora do limite; keyframe em posição vazia; reset de keyframe

F07 Color
    S04 -> S05 -> ColorViewer
    happy path clicks: 3 (clip, aba Color, ajustar)
    edge: clip sem vídeo; reset de todos os controles; salvar como look entre clips

F08 Mixar áudio
    S04 -> S06 -> (nível/pan/mute)
    happy path clicks: 3
    edge: faixa A2 sem clip; clipe sem áudio; volume máximo; unlink de vídeo/áudio

F09 Exportar
    S04 -> S07 -> (preset) -> RenderQueue -> (download)
    happy path clicks: 4
    edge: codec de saída ausente no ffmpeg; render interrompido; arquivo já existe; espaço insuficiente

F10 Salvar e reabrir projeto
    qualquer -> S01 -> S04
    happy path clicks: 2
    edge: fechar o navegador com alteração não salva (beforeunload); projeto aberto em outra aba
```

Clicks no happy path: F04 = 3 (o número a bater).

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| TransportBar | play, pause, step-frame, jump-in/out, add-marker | default, disabled (sem mídia), playing | S03, S04, S05, S06 |
| MediaPool | grid, list, list-com-bins | empty, filled, carregando | S02, S04 |
| BinTree | raiz, subpasta, selecionada | collapsed, expanded, selected | S02 |
| SourceViewer | vídeo, áudio, waveform | vazio, carregando, tocando, sem fonte | S03, S04 |
| Timeline | faixas V1..Vn, A1..An, ruler, playhead, marcadores | empty, filled, dragging, trimming, ripple, snapping | S03, S04 |
| TimelineClip | vídeo, áudio, imagem, título | selecionado, desabilitado, com keyframe, marcado | S04, S05 |
| Transition | cross dissolve, dip to black | selecionado, com duração | S04 |
| Inspector | Video, Audio, Speed, Color | collapsed, tab ativa, campo em foco | S04 |
| PrimaryWheels | lift, gamma, gain, offset, temp/tint | default, alterado, reset | S05 |
| Curves | custom curve, reset | default, alterado | S05 |
| Mixer | canal, master, barramento | muted, solo, sem sinal | S06 |
| ChannelStrip | fader, pan, mute, solo, meter | normal, muted, solo, over | S06 |
| KeyframeEditor | curva de opacidade/volume/transform | vazio, com pontos,多点 | S04 |
| RenderQueue | item pending, rendering, done, failed | vazio, ativo, concluído, erro | S07 |
| Toast | info, warn, error, success | aparecendo, sumindo | todas |
| Dialog | confirmar, cancelar | aberto, fechado | S01, S08, S07 |
| Dropzone | importar mídia | ativo, arrastando, erro | S02 |

## Inferred data model

```
Project      id, name, createdAt, updatedAt, settings{fps, width, height, sampleRate,
             proxyEnabled, proxyScale, renderPath}, bins[], media[], timelines[], activeTimelineId
             evidence: S01 (criar/abrir), S08 (settings), S04 (projecto ativo)
             confidence: high

MediaItem    id, projectId, name, path, kind(video|audio|image), duration, fps, width, height,
             hasAudio, thumbnailPath, proxyPath, status(ready|importing|error), metadata{}
             evidence: S02 (import/bin/metadados), S04 (pool), fonte 7 (sync A/V automático)
             confidence: high

Bin          id, projectId, name, parentId, itemIds[]
             evidence: S02 (organizar mídia em bins), fonte 7
             confidence: high

Timeline     id, projectId, name, duration, tracks[], clips[], markers[], transitions[]
             evidence: S04 (timeline principal), S03 (dual timeline da Cut page)
             confidence: high

Track        id, timelineId, kind(video|audio), index, height, muted, solo, locked, name
             evidence: S04 (pistas V/A), S06 (mixer), fonte 5 (pistas de áudio)
             confidence: high

TimelineClip id, timelineId, trackId, mediaId, start, in, out, enabled,
             transform{x, y, scale, rotation}, opacity, volume, speed, color{...}, keyframes[]
             evidence: S04 (clip + inspector), S05 (color por clip), S06 (volume)
             confidence: high

Keyframe     id, clipId, property(opacity|volume|x|y|scale|rotation), time, value, easing
             evidence: S04 (keyframe editor), fonte 2 ("keyframe editor window")
             confidence: high

Transition   id, timelineId, clipAId, clipBId, kind(cross|dipToBlack), duration, position
             evidence: S04 (transições entre cortes), fonte 2 (biblioteca de transitions)
             confidence: medium

Marker       id, timelineId, time, color, label
             evidence: S04 (marcadores no ruler), fonte 5 (spotting list)
             confidence: medium

Title        id, timelineId, text, fontSize, color, align, trackId, start, duration
             evidence: fonte 2 ("library full of titles"), S04
             confidence: medium

RenderJob    id, projectId, preset, status(queued|rendering|done|failed), progress,
             outputPath, startedAt, finishedAt, error
             evidence: S07 (render queue + presets), fonte 7
             confidence: high

ProjectSettings  fps, width, height, sampleRate, proxyEnabled, proxyScale, renderPath
             evidence: S08, fonte 7 (preset de export)
             confidence: high
```

Relationships: Project 1-n MediaItem, Project 1-n Bin, Project 1-n Timeline, Timeline 1-n Track, Track 1-n TimelineClip, TimelineClip n-1 MediaItem, TimelineClip 1-n Keyframe, Project 1-n RenderJob.

## Feature matrix

See `features.csv`. Must: 24, should: 15, could: 9, skip: 11.

## Out of scope (cannot or should not be cloned)

- **Fusion (composição nodal, tracking, keying, 3D, partículas)** — `skip`: exige motor de composição e GPU; inviável no hardware-alvo e fora do loop central.
- **Multicâmera / Source Tape com N câmeras** — `skip`: exige sync multicâmera em tempo real; o clone faz sync de áudio simples (dual-mono track).
- **Collaboration / Blackmagic Cloud / proxy remoto multiusuário** — `skip`: é a rede da Blackmagic, não uma feature reconstruível.
- **RAW, color management por camera, HDR (Resolve 21)** — `skip`: pipeline de 32-bit float por câmera, matematicamente pesado demais para 2010.
- **Dolby Atmos / mix imersivo** — `skip`:hta licenciada e DSP pesado.
- **Resolve FX completos / Neural Engine / Magic Mask / Super Scale** — `skip`: GPU + modelos; o clone entrega um subconjunto CSS-based.
- **Painéis de hardware (Micro/Mini Color Panel, Speed Editor, consoles Fairlight)** — `skip`: hardware da marca.
- **Adobe/FCP interoperability (AAF/XML/FCPXML, round-trip)** — `skip`: a interoperabilidade com o Resolve é do Resolve.
- **Player profissional com scopes de forma de onda RGB parade, histograma vetorial** — `skip`: exige pipeline de float; o clone entrega histograma e waveform simplificados.
- **Resolução 4K 60fps em tempo real** — `skip`: hardware-alvo não dá; o clone trabalha em proxy e exporta 1080p por padrão.
- **DeckLink / saída SDI / Clone palette** — `skip`: hardware propietario.

## Size

Screens 10, flows 10, entities 11. Hard parts: (1) trim preciso e responsivo em canvas numa máquina lenta; (2) proxies para não choking no playback; (3) exportar via ffmpeg sem ffmpeg local — resolvido com o ffmpeg baixado pelo CI; (4) persistência de projeto sem banco nativo (JSON atômico por projeto).

Size: **M** para o slice do clone (não é o L do Resolve completo) — o slice completo de um NLE profissional seria L; este recorte cabe em ~3-4 semanas de trabalho efetivo. Sem promessas de clone perfeito: o alvo real é "cortar e exportar em máquina fraca", não "substituir o Resolve".
