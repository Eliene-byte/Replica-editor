# Componentes — Replica Editor

Cada bloco = um componente do recon (S-IDs de `replica/recon.md`). Estados incluem
os que o recon viu **e** os que deviam existir: focus, disabled, loading, error, empty.
Tokens referenciam `tokens.json` pelo nome do role.

```
Button
  variants  primary (accent), secondary (surface-2), ghost (transparent), danger
  sizes     sm 24px, md 28px, lg 36px
  states    default, hover, active, focus-visible (2px ring accent, offset 1px),
            disabled, loading (spinner + label mantido para leitor de tela)
  tokens    bg accent / surface-2 / transparent, text on-accent / text, radius md,
            font sm/500
  a11y      <button> real, foco visível, Space/Enter nativos, aria-busy no loading
  used on   S02, S04, S07, S08

IconButton
  variants  default, accent, danger, toggle (pressionado = accent-soft)
  sizes     sm 20px, md 24px, lg 32px
  states    default, hover, active, focus-visible, disabled, toggle-on
  tokens    text-muted -> text no hover, radius sm
  a11y      <button aria-label="..."> obrigatório; ícone é SVG inline (Lucide, MIT),
            nunca imagem com texto embutido
  used on   S03, S04, S05, S06 (transporte, trim modes, toggles de faixa)

Field (input de texto / número)
  variants  text, number, search, path
  sizes     md 28px
  states    default, focus (border accent + ring 2px), invalid (border danger +
            mensagem abaixo), disabled, readonly
  tokens    bg surface-2, border border-input, text text, radius md
  a11y      <label> associado, aria-invalid + aria-describedby no erro
  used on   S02, S05, S06, S07, S08

Toggle (switch)
  variants  on/off
  states    default, hover, focus-visible, disabled
  tokens    track surface-2/border, on accent, knob on-accent
  a11y      <input type="checkbox" role="switch">, rótulo como <label>
  used on   S06 (mute/solo), S08 (proxy), S04 (enable do clip)

Select
  variants  default
  states    default, focus, disabled, open
  tokens    bg surface-2, border border-input
  a11y      <select> nativo — mais leve e acessível que combobox custom
  used on   S07 (preset), S08 (fps/resolução)

Tabs (páginas do app e abas do inspector)
  variants  top (páginas), left (abas verticais do inspector)
  states    active, inactive, focus-visible
  tokens    active text + border-bottom accent, inactive text-muted
  a11y      role="tablist"/"tab"/"tabpanel", setas navegam, aria-selected
  used on   S04 (pages + abas), S05, S06, S07

ProgressBar
  variants  linear (import/render), determinate
  states    running, done, error, indeterminate
  tokens    track surface-2, fill accent, fill success/danger no fim
  a11y      role="progressbar" aria-valuenow/min/max, texto de status ao lado
  used on   S02, S07, S10

Toast
  variants  info, success, warning, error
  states    aparecendo, visível, sumindo
  tokens    bg surface-2 + borda colorida, text text, shadow pop
  a11y      role="status" (info/success) / role="alert" (erro), foco vai para o
            toast, ESC fecha, não some antes de 4 s se houver erro
  used on   todas

Dialog (modal)
  variants  confirmar, cancelar, aviso
  states    abrindo, aberto, fechando
  tokens    bg surface, borda border, radius lg, shadow pop, fundo scrim 60%
  a11y      role="dialog" aria-modal, foco preso dentro, ESC fecha, foco volta
            ao elemento que abriu
  used on   S01, S07, S08

Dropzone
  variants  importar mídia
  states    ocioso, arrastando (borda accent), progresso, erro (formato não suportado)
  tokens    bg surface, borda tracejada border-input, accent no drag
  a11y      input[type=file] oculto com label focável + alternativa por teclado
            (botão "Escolher arquivos"), announce de progresso via aria-live
  used on   S02

MediaPool
  variants  grid (miniaturas), lista (tabela), lista-com-bins
  states    vazio (nenhum item), carregando (skeleton), preenchido, filtro sem
            resultado, erro
  tokens    bg surface, item selecionado = bg accent-soft + borda accent
  a11y      lista com role="list", item role="listitem" + botão, navegação por
            setas, nome do arquivo sempre visível (não só no tooltip)
  used on   S02, S04

BinTree
  variants  raiz, subpasta, selecionada
  states    recolhida, expandida, selecionada
  tokens    texto text / text-muted, selecionada accent-soft
  a11y      role="tree", setas navegam, right abre/fecha, aria-expanded
  used on   S02

SourceViewer
  variants  vídeo, áudio (waveform), vazio
  states    vazio, carregando (proxy), tocando, sem fonte, erro de mídia
  tokens    bg #000, moldura border, contador timecode mono
  a11y      <video controls> nativo como fallback; atalhos de transporte
            announced; sem auto-play
  used on   S03, S04, S05

Timeline
  variants  vídeo, áudio, compacto (Cut page)
  states    vazia, preenchida, arrastando, trimando, com playhead, multi-seleção
  tokens    bg timeline-bg, ruler surface-2, track alternada surface, clip
            clip-video / clip-audio, selecionado *-active, playhead playhead,
            waveform wave, marker warning
  a11y      <canvas> com fallback textual (lista de clips); navegação por teclado
            setas = mover playhead, Shift+setas = mover clip; cada ação anuncia
            o novo tempo em frames
  used on   S03, S04

TimelineClip
  variants  vídeo, áudio, imagem, título, desabilitado (checkbox de enabled)
  states    selecionado, hover, arrastando, trimando (borda), com keyframe
            (losango), desabilitado (opacidade 45%)
  tokens    bg clip-video / clip-audio, texto text, borda 1px
  a11y      rótulo = nome do arquivo + in/out; trim por teclado com Alt+setas
  used on   S03, S04

Transition
  variants  cross dissolve, dip to black
  states    selecionado, hover
  tokens    hatch diagonal sobre clip-audio, duração em frames
  a11y      nome "transição X, N frames"
  used on   S04

Inspector
  variants  vídeo, áudio, velocidade, cor
  states    colapsado, aba ativa, campo em foco, sem seleção
  tokens    bg surface, separadores border, campos surface-2
  a11y      abas com role="tab"; cada controle com label e valor numérico
            editável; valores com unidade
  used on   S04

KeyframeEditor
  variants  curva linear, curva de Bézier (should), vazia
  states    vazio, com pontos, ponto arrastado
  tokens    linha wave, pontos accent, linha do tempo surface-2
  a11y      lista de keyframes com frame e valor, editável por teclado
  used on   S04

PrimaryWheels
  variants  lift, gamma, gain, offset, temperatura/tint
  states    default, alterado, reset, hover
  tokens    anel accent, centro surface-2, label text-muted
  a11y      cada roda é um slider numérico (range) com valor textual
  used on   S05

Curves
  variants  custom, reset
  states    default, alterado
  tokens    grade surface-2, curva accent
  a11y      pontos como sliders XY com frame e valor
  used on   S05

Mixer / ChannelStrip
  variants  canal, master, barramento
  states    normal, muted, solo, sem sinal, over
  tokens    bg surface, fader surface-2, knob accent, meter success→warning→danger
  a11y      fader é <input type="range"> com aria-valuetext em dB; meters têm
            texto alternativo (peak em dB)
  used on   S06

RenderQueue
  variants  item pendente, renderizando, concluído, falhou
  states    vazia, ativa, concluída, com erro
  tokens    bg surface, status success/danger/warning
  a11y      cada item com aria-label do preset; progresso com role="progressbar";
            erro com o log em <details>
  used on   S07

ShortcutSheet
  variants  overlay
  states    aberto, fechado
  tokens    bg surface, shadow pop
  a11y      role="dialog", foco preso, ESC fecha, tabela de atalhos legível
            por leitor de tela
  used on   S09 (todas as telas)
```

## Regras transversais

- Nenhum texto abaixo de 11px; 11px só em rótulo de eixo/ruler, nunca em texto de ação.
- Foco sempre visível: `:focus-visible` com anel de 2px em `--accent`.
- Nenhuma cor da paleta original. `--accent` é um placeholder neutro-ámbar; o
  `replica-brand` define a paleta final.
- Ícones: Lucide (MIT) em SVG inline — sem sprite, sem fonte de ícones.
- Nada de `box-shadow` grande em área repetida (timeline, pool): em máquina fraca,
  sombra difusa custa repaint.
