# Ferramentas do pacote replica

Copias locais das ferramentas Python do pacote `replica-skill` (MIT, Jake Schincariol),
para que o CI e o repositorio nao dependam da pasta de skills do usuario.

| ferramenta | uso |
| --- | --- |
| `parity.py` | nota de paridade do clone contra o original (`replica/features.csv`) |
| `imgdiff.py` | comparacao de layout entre duas capturas (ignora cor) |
| `sweep.py` | varredura do codigo em busca de marcas do original |
| `reviews.py` | ranking do que as pessoas reclamam, com link de origem |
| `listing.py` | lint de titulo e descricao de loja |

Executar: `python3 tools/parity.py replica/features.csv`
