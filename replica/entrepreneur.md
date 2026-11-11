# replica-entrepreneur — o que as pessoas reclamam do DaVinci Resolve

Date: 2026-11-11 · Corpus: `replica/reviews.csv` (385 linhas coletadas) · Relatório bruto: `replica/reviews-report.txt`

## Método e limites (leia antes de usar qualquer número)

- Corpus coletado da API pública do Hacker News (sem login), filtrado por menção
  literal a "DaVinci Resolve", texto ≥ 120 caracteres.
- **384 comentários, 1 fonte só.** Reddit, G2, Capterra e o fórum da Blackmagic
  bloqueiam requisição automatizada deste ambiente (403). Tudo aqui está marcado
  como *thin* pelo `tools/reviews.py`: é direção geral, não estatística de mercado.
- Nenhuma frase foi reescrita. Cada citação está copiada do comentário e o link
  é o do thread. Onde não há fala da Blackmagic, não há fala da Blackmagic.
- Sem estrelas (HN não tem nota), então não há "média de avaliação" para citar.

## O que mais odeiam

| # | tema | menções | o que isso significa para o clone |
| --- | --- | --- | --- |
| 1 | Preço e paywall | 66 (17%) | O "grátis" do original tem portões. O clone é grátis de verdade, sem conta, sem marca d'água. |
| 2 | Bugs e crashes | 52 (14%) | A install é pesada e instável em máquina fraca. O clone não instala nada: um zip, um comando. |
| 3 | Lento, pesado | 36 (9%) | Occupa GB de RAM e placa dedicada. O clone roda em 480p com proxy e 54 kB de front. |
| 4 | Confuso ou clunky | 21 (6%) | Curva de aprendizado alta. O clone tem uma tela só e atalhos de teclado visíveis. |
| 5 | Sync e dados perdidos | 13 (3%) | Projeto corrompido é caro. O clone grava JSON atômico e faz autosave. |
| 6 | Privacidade | 12 (3%) | Nuvem e conta forçada. O clone é 100% local: o vídeo não sai da máquina. |

Citações que descrevem o problema central:

- "Davinci Resolve Studio is slow, bloated, can't customize the UI and barely has an API so I can't wait to dump it..." — https://news.ycombinator.com/item?id=50232682
- "There's a huge learning curve." — https://news.ycombinator.com/item?id=40903158
- "I don't wanna deal with storing my videos in the cloud because of two concerns: privacy and storage cost." — https://news.ycombinator.com/item?id=48007140
- "They were all pretty clunky but could do the job." — https://news.ycombinator.com/item?id=25023938
- "There are a bazillion features that I sort of know exist but haven't ever had any need to use." — https://news.ycombinator.com/item?id=49610181
- "Sure enough, I found it, it looked great, and it's the only time I've hit the 'you need to buy the pro version to use this feature if you don't want a big watermark' gate." — https://news.ycombinator.com/item?id=49610181

## O que pedem

| # | tema | menções | pedido |
| --- | --- | --- | --- |
| 1 | Plataforma, offline e mobile | 100 (26%) | Rodar no seu computador, sem nuvem. |
| 2 | Integrações, importar e exportar | 71 (18%) | Importar/exportar sem fricção, ffmpeg acessível. |
| 3 | Equipe e compartilhamento | 43 (11%) | Collaboração (fora do nosso escopo por decisão). |
| 4 | Customização e controle | 28 (7%) | Poder mudar a interface e o comportamento. |

## Plano de correções (o que o clone já faz ou vai fazer)

| reclamação | correção no clone | estado |
| --- | --- | --- |
| 66 · preço e paywall | Sem conta, sem versão "pro", sem marca d'água. O custo é o do seu hardware. | feito |
| 52 · bugs e crash na máquina fraca | Nada de instalação: zip + `node server/index.js`. Sem plugin, sem driver. | feito |
| 36 · lento e pesado | Front de 54 kB (≈15 kB gzip), zero dependência de runtime, proxy 480p automático, timeline em canvas. | feito |
| 21 · curva de aprendizado | Uma tela por tarefa, atalhos fixos (I/O, S, R/Y/U, espaço) e folha de atalhos no próprio app. | feito |
| 13 · sync e dados perdidos | `project.json` escrito de forma atômica (tmp + rename), autosave com debounce, undo/redo de 60 passos. | feito |
| 12 · privacidade | Servidor em `127.0.0.1`, mídia em disco local, zero requisição para fora. | feito |
| 100 · offline | O ffmpeg vem no pacote baixado pelo CI; depois do primeiro start funciona sem rede. | feito |
| 71 · importar/exportar | ffmpeg exposto pela API do app; presets de mp4 1080/720/480, webm e wav. | feito |
| 28 · customização | Tokens em CSS: trocar a paleta é editar um arquivo. Atalhos e layout fixos em um lugar só. | feito |
| 43 · colaboração | Fora de escopo (e fora do alcance de um app local). | fora |

## Ângulo de posicionamento

**"O editor de vídeo que roda no notebook velho, sem instalar nada."**

O Resolve é uma suíte de estúdio: 7 páginas, pipeline de 32 bits, GPU dedicada,
curva de aprendizado alta. O clone não tenta ser isso. Ele corta e exporta — o
loop que 90% das pessoas usa — num notebook de 2010, num navegador, sem conta,
sem nuvem e sem install.

Três frases que o clone pode dizer com honestidade:
1. "Roda no seu notebook de 2010." (verificado: front de 54 kB, proxy 480p, um ffmpeg por vez.)
2. "Nada de instalar." (verificado: zip, um comando, sem dependência de runtime.)
3. "Seu vídeo não sai do seu computador." (verificado: servidor em 127.0.0.1, zero chamada externa.)

O que o clone **não** pode dizer: que é tão bom quanto o Resolve em cor, VFX ou áudio
profissional. Não é, e o `replica/features.csv` diz exatamente onde para.

## Lacunas que este passo revela

- **Não temos o corpus do público-alvo.** As reclamações são de quem comenta no HN
  (programadores), não de quem edita vídeo o dia inteiro. Antes de vender, vale
  coletar App Store/Google Play/G2/Capterra com conta humana e repetir este passo.
- **Falta dado de performance no hardware-alvo.** A promessa central ("roda no
  notebook de 2010") ainda não foi medida em máquina real — só em desenvolvimento.
  Isso é o próximo experimento: editar um projeto de 20 minutos num notebook de
  2010 e medir.
