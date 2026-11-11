# replica-launch — Corte Leve

Date: 2026-11-11 · Ângulo: `replica/entrepreneur.md` · Marca: `replica/brand.md` · Listagem: `replica/launch/listing.json`

## 1. Landing page

Cópima em `site/index.html` (HTML único, CSS inline, zero dependência, ~14 kB).
Seções na ordem em que a pessoa decide se fica:

1. **Hero** — "Corte vídeo no notebook velho. Sem instalar nada."
   Sub: "Editor de vídeo no navegador. Importa, corta e exporta em mp4 — 15 kB de app, 4 GB de RAM, zero conta."
   Botão: "Baixar o pacote" + linha secundária "Ver o código".
2. **O problema** — os dois maiores temas de reclamação em linguagem simples:
   "Duas horas instalando" e "o notebook trava". Sem citar autor.
3. **Como funciona** — três passos: importar → cortar → exportar.
4. **Recursos** — cada um amarrado a uma correção do `entrepreneur.md`
   (nada de lista de paridade; paridade é o preço de entrada, não o argumento).
5. **Preço** — tabela do `pricing.md`.
6. **FAQ** — as objeções reais: "funciona no meu notebook?", "meu vídeo vai para a nuvem?",
   "dá para importar do Premiere?", "exporta o que?".
7. **CTA final** — baixar o zip.

Sem prova inventada: não há depoimento, contagem de usuários, logo de imprensa nem nota.
A seção de prova fica vazia de propósito.

## 2. Preço

Ver `replica/launch/pricing.md`.

## 3. Listagem de loja

`replica/launch/listing.json` — App Store e Google Play.

```
python tools/listing.py replica/launch/listing.json
→ 0 errors, 0 warnings
```

Nenhum nome do original aparece em nome, subtítulo, texto promocional,
descrição, keywords ou "novidades". Isso é exigência da Apple (4.1 Copycats) e
é também o certo: o produto é outro.

Preparar antes de submeter (o que ainda falta):
- Capturas nos tamanhos exigidos (verificar no App Store Connect / Play Console na hora do envio)
- Política de privacidade e URL de suporte (o app é local: a política é curta)
- Ficha de privacidade / Data safety: sem coleta, sem conta, sem analytics por padrão
- Classificação etária: 4+
- Notas de revisão: sem conta para testar — abrir o app e pronto (isso é um diferencial real)

## 4. Plano de lançamento

Ver `replica/launch/launch-plan.md`.
