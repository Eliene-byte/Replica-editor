# replica-brand — Corte Leve

Date: 2026-11-11 · Ângulo: `replica/entrepreneur.md` · Varredura: `replica/brand.json`

## 1. O nome

20 candidatos, depois 5. O corte final segue o teste de "¿soa parecido com o
original?" (som, forma e sentido) — nenhum trofão, nenhum "-inho" do Resolve.

| estilo | candidatos |
| --- | --- |
| descritivo | Corte Leve, Editor Leve, Vídeo Local, Monta Leve, Corte Offline |
| composto | LeveCorte, CorteZero, FrameVivo, LinhaViva, ByteCorte |
| inventado | Veluma, Bitelo, Trancoso, ZeraCorte, Veltro |
| metáfora | Bancada, Encaixe, Trama, Retícula, Régua |
| verbo | Recortar, Encaixar, Montar, Aparar, Alinhar |

**Finalistas (5)** e por que ficaram:

| nome | a favor | contra |
| --- | --- | --- |
| **Corte Leve** | diz o que faz e para quem; `.com`, `.app` e `.dev` livres | "corte" sozinho é genérico — por isso "leve" |
| Bancada | metáfora boa de trabalho; `.dev` livre | `.com` e `.app` ocupados |
| Encaixe | nome da ação central do editor (encaixar o corte) | `.com` e `.app` ocupados; abstrato fora do contexto |
| Trama | curto, bonito, evoca montage | `.com`, `.app` e `.dev` ocupados |
| Retícula | técnico, mas é só grade | `.com` e `.app` ocupados |

**Escolhido: Corte Leve.** Domínios livres, som distinto do original, e o nome
diz a promessa: cortar (o loop do Resolve) + leve (o nosso ângulo).

## 2. As checagens

Rodadas = resultado real com data. "A rodar" = ainda não rodada, e não se escreve
"disponível" para o que ninguém checou.

| checagem | onde | Corte Leve | Bancada | Encaixe | Trama | Retícula |
| --- | --- | --- | --- | --- | --- | --- |
| domínio .com | RDAP Verisign | **livre (11/11/2026)** | registrado | registrado | registrado | registrado |
| domínio .app | RDAP Google | **livre (11/11/2026)** | registrado | registrado | registrado | registrado |
| domínio .dev | RDAP Google | **livre (11/11/2026)** | livre | livre | registrado | livre |
| marca US (classe 9/42) | tmsearch.uspto.gov | a rodar | a rodar | a rodar | a rodar | a rodar |
| marca EU | TMview / euipo | a rodar | a rodar | a rodar | a rodar | a rodar |
| marca CA | ised-isde | a rodar | a rodar | a rodar | a rodar | a rodar |
| marca global | WIPO GBD | a rodar | a rodar | a rodar | a rodar | a rodar |
| App Store / Play | busca exata | a rodar | a rodar | a rodar | a rodar | a rodar |
| handles (X, IG, TikTok, GitHub) | busca exata | a rodar | a rodar | a rodar | a rodar | a rodar |
| busca web "nome + categoria" | busca | a rodar | a rodar | a rodar | a rodar | a rodar |

Isto é triagem, não liberação de uso: antes de gastar dinheiro com o nome, um
advogado de marca precisa fazer busca completa.

## 3. Paleta

O original usa azul de marca. A nossa família é **verde-lima**, longe do azul e
do roxo do Premiere. Valores nos mesmos roles do `replica-design`:

| role | valor | porquê |
| --- | --- | --- |
| accent | `#c8f751` | lima elétrica: destaca em tela escura sem parecer "botão do sistema" |
| on-accent | `#14180a` | quase preto: texto sobre lima com contraste 14,5:1 |
| accent-soft | `#2c3a12` | fundo da seleção, versão apagada do lima |
| bg / surface | `#0f1115` / `#161a20` | neutro frio, sem viés de cor |
| playhead | `#ff4d6d` | rosa-vermelho: separado do accent para não confundir cursor e seleção |

Verificação: `python tools/contrast.py replica/design/tokens.json` → 26 pares,
0 falhas AA.

## 4. Brief de logo

- **A ideia em uma linha**: um corte que encaixa — duas metades de quadro que se
  juntam, e o encaixe é o que segura tudo junto.
- **Tipo de marca**: símbolo + wordmark. símbolo geométrico (dois blocos que se
  tocam em diagonal) com a palavra "Corte Leve" ao lado.
- **Precisa funcionar em 16px** (favicon) e como ícone 1024×1024.
- **Entregáveis**: SVG vetorial, app icon 1024×1024 sem transparência (iOS),
  conjunto de favicon (16/32/180/512), imagem social 1200×630.
- **Não pode lembrar o original**: nada de Three Balls, nada de "D", nada de
  azul, nada de gradiente circular. Coloca o logo do original ao lado dos
  rascunhos e confere.

## 5. Voz

Três palavras: **direto** (não grosseiro), **calmo** (não preguiçoso),
**honesto** (não minimalista demais).

| faz | não faz |
| --- | --- |
| "Cortar" | "Começar sua jornada criativa" |
| "Seu vídeo não sai daqui" | "Proteção de privacidade de nível corporativo" |
| "Nada para instalar" | "Instalação ultrarrápida com disruptsão" |
| "Exportar agora" | "Finalizar sua obra-prima" |
| "Faltou o ffmpeg — o CI baixa na próxima build" | "Erro desconhecido (código 3)" |

As 10 strings mais vistas do clone, reescritas:

| onde | antes | depois |
| --- | --- | --- |
| topo | Replica Editor | **Corte Leve** |
| título do app | Replica Editor | Corte Leve — editor de vídeo leve |
| sem projeto | Nenhum projeto ainda | Nenhum projeto ainda. Crie um e corte. |
| sem mídia | Nenhuma mídia ainda | Nenhuma mídia ainda. Arraste um vídeo para cá. |
| importando | Importando N arquivo(s)… | Trazendo N arquivo(s) para o projeto… |
| botão principal | Novo projeto | Novo projeto |
| botão de export | Iniciar export | Exportar vídeo |
| erro de export | ffmpeg saiu com código X | O ffmpeg parou com erro (código X). O log está abaixo. |
| sem clipe selecionado | Selecione um clipe na timeline para editar. | Escolha um clipe na timeline para ver as opções dele. |
| ferramentas | Ferramenta de corte | Cortar no ponto do cursor |

## 6. A varredura

```
python tools/sweep.py . --config replica/brand.json
```

O que ele caça: nome do original (inclusive dentro de identificadores como
`BlackmagicEmbed`), domínios e cores do original, mais o nome-placeholder
"Replica Editor". Pula `node_modules`, `dist/`, `build/`, `data/` e a pasta de
planejamento `replica/`.

Resultado da última rodada: **limpo** (ver `replica/sweep.txt`).

Olho humano também: favicon, título da aba, texto do topo, imagem social —
nenhum tem marca do original.
