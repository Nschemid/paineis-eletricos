# Catálogo — forma dos dados e algoritmo de matching

Store Netlify Blobs `catalog` (via `netlify/functions/data.mjs?store=catalog`), um blob
só contendo o array inteiro em JSON. Começa vazio — não popular com dados fictícios.

## Forma de cada item

```json
{
  "id": "uuid-v4",
  "tipo_componente": "rele",
  "fabricante_marca": "WEIDMULLER",
  "referencia": "",
  "padrao_tag": "DCR",
  "aplicacao": "relé de interposição para comando de damper / partida de ventilador",
  "polos": 1,
  "notas": "relé padrão da empresa para sinalização de partida/parada de ventiladores",
  "criado_em": "2026-07-18T12:00:00.000Z",
  "atualizado_em": "2026-07-18T12:00:00.000Z"
}
```

`referencia` e `padrao_tag` são opcionais de propósito: como a maioria dos desenhos
reais não traz o part number completo do fabricante (ver `extraction-schema.md`), o
catálogo precisa casar também por tipo + padrão de tag + aplicação, não só por
referência exata.

## Algoritmo de matching (`js/match.js`, roda no cliente, sem lógica no backend)

Três níveis, o primeiro que bater vence:

1. **Referência exata/prefixo** — normaliza (`toUpperCase`, remove espaços/hífens) e
   compara `referencia_fabricante` do item extraído com `referencia` do catálogo via
   igualdade ou `startsWith` nos dois sentidos (cobre "SIEMENS 3RT20..." truncado do
   desenho casando com "3RT2016-1BB41" completo do catálogo), só quando
   `fabricante_marca` bate também (quando presente nos dois lados).
2. **Padrão de tag** — tira os dígitos finais do `tag` (`DCR1` → `DCR`) e compara com
   `padrao_tag` do catálogo, combinado com `tipo_componente` igual.
3. **Tipo + aplicação (fuzzy simples)** — `tipo_componente` + `fabricante_marca` (se
   presente) + interseção de palavras entre `descricao`/`evidencia` do item e
   `aplicacao` do catálogo (minúsculo, split por espaço, conta palavras em comum acima
   de um limiar pequeno). Sem lib externa, sem embeddings.

## Status resultante por linha

- `confirmado` — nível 1 ou 2, candidato único
- `sugestao` — nível 3, ou múltiplos candidatos em qualquer nível (mostrado como chip
  clicável, nunca aplicado automaticamente)
- `sem_correspondencia` — nenhum candidato

Em todos os casos, `polos` na tabela de revisão continua editável — catálogo só
pré-preenche, a usuária decide.
