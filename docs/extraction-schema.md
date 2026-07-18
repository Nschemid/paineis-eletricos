# Schema de extração

Implementado em `netlify/functions/analyze-drawing.mjs`. O prompt completo e o
`responseSchema` (dialeto Gemini, tipos em maiúsculo) vivem no código-fonte da function
— este arquivo documenta a forma dos dados pra quem for consumir o resultado no frontend.

## Request para a function

```
POST /.netlify/functions/analyze-drawing
{
  "files": [
    { "file": "<base64, sem prefixo data:...>", "mimeType": "image/jpeg" | "application/pdf" | ..., "name": "ME331.pdf" },
    { "file": "...", "mimeType": "application/pdf", "name": "ME333-C1.pdf" }
  ]
}
```

Aceita 1 ou mais arquivos numa chamada só, representando folhas diferentes do mesmo
conjunto de desenhos. O prompt instrui o modelo a tratá-los como um conjunto único,
cruzar informação entre eles (ex: legenda numa folha + símbolo em outra) e não duplicar
o mesmo componente físico se ele aparecer referenciado em mais de um arquivo. Cada
arquivo é identificado no prompt pelo `name` enviado — use nomes de arquivo
significativos no upload, viram literalmente o texto que a IA usa em `folha_origem`.

## Resposta

```json
{
  "desenho": { "numero": "ME332", "titulo": "SWITCHBOARD LAYOUT", "projeto": "R-MSSB7-ESS" },
  "componentes": [
    {
      "tag": "DCR1",
      "descricao": "DAMPER CONTROL RELAY",
      "tipo_componente": "rele",
      "fabricante_marca": "WEIDMULLER",
      "referencia_fabricante": "",
      "polos": 0,
      "fonte_polos": "nao_disponivel_no_desenho",
      "evidencia": "Legenda de relés lista 'DCR1 DAMPER CONTROL RELAY, GF-MFD1' — dá tag e função, não modelo nem polos.",
      "confianca": "alta",
      "folha_origem": "ME333",
      "observacoes": ""
    }
  ],
  "notas_gerais": ""
}
```

## Os 3 valores de `fonte_polos`

| Valor | Significado | Frequência esperada |
|---|---|---|
| `bom` | Legenda/tabela do desenho diz o polos em texto | Raro |
| `simbolo` | Polos determinado contando barras de fase (N/A/B/C) que o símbolo toca no diagrama unifilar | Comum em disjuntores/chaves |
| `nao_disponivel_no_desenho` | Desenho só dá marca/tag/função, sem polos determinável | **Maioria dos casos**, principalmente relés e contatores |

Quando `fonte_polos` é `nao_disponivel_no_desenho`, `polos` vem `0` (sentinela) e a
resolução acontece na tela de revisão via cross-reference com o catálogo (ver
`catalog-schema.md`) ou entrada manual da usuária.

## Campo `evidencia`

Obrigatório, texto livre, sem limite de tamanho. Precisa ser específico o suficiente
pra uma pessoa conferir contra o desenho original sem precisar reabrir tudo do zero —
cita o texto exato da legenda, ou descreve concretamente quais barras/fases o símbolo
toca. "3 polos" sozinho não é evidência aceitável; o prompt instrui o modelo a nunca
devolver isso sem a descrição do que foi visto.

## Campo `resolvido_via` (só na tela de revisão, não faz parte da extração)

Adicionado no cliente ao salvar a lista revisada: `"extracao"` (valor veio direto da IA,
sem intervenção), `"catalogo"` (usuária aceitou uma sugestão do catálogo), `"manual"`
(usuária digitou/editou o valor). Serve pra rastrear a origem real do dado que vai pra
compra, separado da origem que a IA leu no desenho.
