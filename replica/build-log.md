# Build log — Corte Leve

Cada linha: tela do recon, data, estado, o que falta, o que foi mais difícil
do que parecia. featureMatrix: `replica/features.csv`.

| Tela | Data | Estado | O que falta | O que foi mais difícil |
| --- | --- | --- | --- | --- |
| S01 Project Manager | 2026-11-11 | feito | — | Nada. Criar/abrir/apagar projeto foi a parte calma. |
| S02 Media | 2026-11-11 | feito | subpasta de bin aninhada | O parser de multipart em streaming: arquivo de 4 GB não pode caber na RAM. Escrevi à mão (sem dependência) e ele perdeu o delimitador entre dois chunks — 3 bugs até passar nos testes. |
| S03 Cut | 2026-11-11 | parcial | página de verdade com source tape | A Cut page virou a Edit page em modo compacto. Source Tape (fita de origem rolando) não foi feito. |
| S04 Edit | 2026-11-11 | feito | reprodução simultânea de várias faixas | O arrasto com trim: se recalcular a partir do estado atual, o clip "anda" duas vezes. Congelei a timeline base no início do arrasto. |
| S05 Color | 2026-11-11 | parcial | rodas e curvas de verdade | O preview no navegador (filtro CSS) e o render (filtro `eq` do ffmpeg) precisam concordar — dois lugares para a mesma verdade. |
| S06 Audio | 2026-11-11 | parcial | medidores VU e waveform | Mistura por faixa ficou simples de propósito. |
| S07 Deliver | 2026-11-11 | feito | — | Montar o grafo de filtros do ffmpeg: fundo preto + overlay por clipe + `amix` com `normalize=0`. Três bugs de label (`[a][b]` virando `[[a][b]]`) e o `rotate` com 0° que quebrava o `pad`. |
| S08 Settings | 2026-11-11 | feito | — | Nada. |
| S09 Atalhos | 2026-11-11 | feito | — | Conflito de teclas: `S` para corte vs. salvar. Corte ficou em `B`. |
| S10 Import | 2026-11-11 | feito | — | Proxy e miniatura em background: o import responde na hora e o app avisa quando fica pronto. |

## O que foi maior do que parecia

1. **O `rAF` não dispara em aba sem foco.** A timeline ficava em branco. Agora
   há um fallback por timer: em máquina lenta ou aba de fundo, o desenho
   acontece mesmo assim.
2. **Canvas em 300×150 é o tamanho padrão.** Se o primeiro desenho não rodar, o
   canvas fica com o tamanho do HTML e parece quebrado. A primeira versão
   tinha `dirty = true` no início, o que cancelava o primeiro desenho para
   sempre.
3. **ffmpeg não aceita `[[a][b]]`.** Um label a mais e o grafo inteiro não
   liga — o erro aparece como "output unconnected", longe da causa.
4. **`rotate=0` aumenta o quadro.** Depois dele, o `pad` reclamava que a
   entrada era maior que a saída. Agora a rotação só entra quando é preciso.
5. **Salvar projeto em JSON sem corromper.** Escrita atômica (tmp + rename) e
   fila de escrita por projeto. Duas abas no mesmo projeto: a segunda recebe
   409.
6. **Upload por streaming.** Um vídeo de 2 GB em notebook de 4 GB não cabe em
   memória. O import vai direto para o disco.

## O que ficou fora (e por quê)

- **Fusion, multicâmera, collaboration, RAW/HDR, Atmos**: fora do slice do
  recon e do orçamento de hardware. Está em `features.csv` como `skip`, com o
  motivo.
- **Reprodução simultânea de várias faixas**: o playback atual toca o clipe sob
  o cursor. Tocar vídeo e áudio juntos, com áudio, exige um motor de
  sincronização — trabalho de um dia inteiro, e é a próxima fatia.
- **Waveform de áudio na timeline**: exige extrair o pico do áudio no import
  (ffmpeg → arquivo de picos). Falta.
- **Títulos e transições**: modelo já tem `Transition` e `Title` no schema;
  a UI e o render não trata.
