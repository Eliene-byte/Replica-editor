# replica-launch — plano de lançamento

Date: 2026-11-11

## Antes de qualquer anúncio

1. **Medir o que prometemos.** "Roda no notebook de 2010" é a promessa central e
   ainda não foi provada em hardware real. Teste: um projeto de 20 minutos,
   1080p, em notebook de 2010 (4 GB RAM, sem GPU dedicada). Medir: tempo de
   import com proxy, fluidez da timeline, tempo de export. Se não bater, o
   anúncio não sai — o texto muda.
2. **Screenshot real** do app rodando, com o proxy e a timeline visíveis.
3. **Fechar as 6 lacunas *must*** que a paridade ainda marca (ver `features.csv`).
   Paridade baixa na vitrine é exatamente o que o público do original odeia.

## Fila de espera antes do lançamento

- Formulário de uma pergunta só: "qual o processador e a RAM do seu notebook?"
  Isso serve para medir o hardware-alvo de verdade.
- GitHub Issues como canal primário (o repo já é o produto).
- Sem lista de e-mail com tecnologia de marketing: o app é local, quem usa
  baixa o zip.

## Onde o público insatisfeito do original conversa

Do corpus coletado: **Hacker News** (link dos threads em `reviews.csv`).
Reddit, G2 e Capterra bloquearam a coleta automática; a busca manual nesses
lugares é trabalho manual e precisa ser feito antes do lançamento.

## O post (Hacker News / Product Hunt)

Estrutura:

1. **Primeira linha: a dor, não o produto.** "Cortar vídeo no meu notebook de
   2010 não devia exigir 8 GB de RAM e uma placa dedicada." (não citar o
   original pelo nome no título).
2. **O que é:** editor de vídeo local, no navegador, 15 kB de app.
3. **Prova concreta:** o número do bundle, o tempo de import com proxy, o
   tamanho do pacote, o hardware em que rodou.
4. **O que ele NÃO faz:** composição 3D, tracking, cor de estúdio. Dizer isso
   cedo evita a decepção que o público do original já tem com software
   "completo" que trava.
5. **Pedido:** "se o seu notebook é antigo, me conta o que travou."

Sem número inventado, sem "usado por X pessoas" sem prova.

## Os 10 primeiros usuários

Falar com 10 pessoas na mão (fórum, Reddit, grupo local de edição). Para cada
uma:

- observar 15 minutos editando (sem explicar nada)
- anotar onde trava, onde demora, o que procura e não acha
- perguntar o que ela pagaria — e anotar a resposta literal

Esse material volta para o `replica-entrepreneur` (nova rodada, agora com o
público certo) e para o backlog.

## Métrica

Sem analytics remoto (o app é local, e rastrear pessoas é o oposto da
proposta). Métricas:

- downloads do release no GitHub (anônimo)
- issues abertas e fechadas
- número de pessoas que respondem "funciona no meu notebook X"

## O que NÃO fazer

- Não comprar nome de domínio antes da busca de marca rodar (as marcas
  ainda estão "a rodar" em `replica/brand.md`).
- Não publicar nada antes de medir o hardware-alvo.
- Não usar o nome do original em título, tag, anúncio ou nome de pacote.
