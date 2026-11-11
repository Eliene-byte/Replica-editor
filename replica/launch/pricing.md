# replica-launch — preço

Date da leitura dos preços: **2026-11-11**. Preço muda: releia antes de publicar.

## O que o original cobra (página pública lida em 2026-11-11)

| produto | preço público | modelo | link |
| --- | --- | --- | --- |
| DaVinci Resolve (Free) | US$ 0 | 8-bit até 60 fps, até 3840×2160, multi-user e HDR grading inclusos | https://www.blackmagicdesign.com/products/davinciresolve |
| DaVinci Resolve Studio | US$ 236 (promo; preço anterior US$ 295) | compra única, adiciona Neural Engine, 10-bit 120 fps, mais Resolve FX | https://www.blackmagicdesign.com/products/davinciresolve |
| Final Cut Pro (Apple) | US$ 299,99 | compra única | https://www.apple.com/final-cut-pro/ |

Adobe Premiere Pro: **não lido** (a página de planos bloqueou requisição deste
ambiente com 403). Não inventar número: ler antes de citar.

## O que as pessoas disseram (corpus do `entrepreneur.md`)

- **Preço e paywall — 66 menções (17% do corpus)**, a maior reclamação.
- "the only time I've hit the 'you need to buy the pro version to use this feature if you don't want a big watermark' gate" — https://news.ycombinator.com/item?id=49610181
- "Ad-free, install-free and account-free version." — https://news.ycombinator.com/item?id=50360658

Leitura: o que mais incomoda não é o preço em si, é o *paywall no meio do
fluxo* — feature que você precisa só funciona na versão paga. E o argumento
"é grátis" perde quando a instalação custa horas.

## Nosso modelo

**Um plano só: gratuito, open source (MIT), sem conta, sem cobrança.**

Não há versão "pro" para comparar, não há upgrade, não há cobrança por
usuário, não há renewal. Isso mata as três reclamações de preço na raiz:
sem paywall, sem surpresa de cobrança, sem cancelamento.

Preço por能从 servidor? Não há servidor: o app roda na máquina do usuário.
Custo marginal para o usuário = o hardware que ele já tem.

## Tabela

| plano | para quem | preço | inclui |
| --- | --- | --- | --- |
| Corte Leve | quem corta o próprio vídeo | US$ 0 | tudo: timeline, keyframes, cor, mixagem, export mp4/webm/wav, sem marca d'água |

Três planos no máximo — e aqui só tem um porque é o que a verdade permite.

## Stripe / produtos a criar

**Nenhum.** Não há produto pago, não há webhook, não há subscription. Se um dia
existir (ex.: hospedar a fila de render para quem não quer instalar), aí sim:
- `plano render remoto` — US$ 9/mês, cobrança por fila, cancelamento em 1 clique
  (reclamação recorrente: "cancelar foi difícil")
- Sem taxa por seat: a reclamação de "preço por pessoa" cai fora.

## Correções de billing dentro do produto

- Não há cobrança: nada a consertar.
- O que substitui a cobrança é a garantia de que nada sai da máquina: o projeto
  fica em `data/`, e apagar a pasta apaga tudo.
