# Schema de extração

Implementado em `netlify/functions/analyze-drawing-background.mjs` (função assíncrona —
ver `docs/app-reference.md` pra explicação do padrão job/polling) + `job-status.mjs`
(consulta de status). O prompt completo e o `responseSchema` (dialeto Gemini, tipos em
maiúsculo) vivem no código-fonte da function — este arquivo documenta a forma dos dados
pra quem for consumir o resultado no frontend.

## Fluxo assíncrono (job + polling)

Análise de várias folhas juntas facilmente passa do limite de ~10s de uma Netlify
Function síncrona, então a extração roda como **Background Function** (até 15 min,
sem resposta direta) e o cliente consulta o resultado por polling:

```
1. Cliente gera um jobId (uuid) e faz:
   POST /.netlify/functions/analyze-drawing-background
   { "jobId": "...", "files": [{ "file": "<base64>", "mimeType": "...", "name": "ME331.pdf" }, ...] }
   → resposta imediata (202/200 vazio, o corpo não importa)

2. Cliente faz polling a cada ~3s:
   GET /.netlify/functions/job-status?jobId=...
   → { "status": "pending" }                              (ainda rodando)
   → { "status": "done", "result": { ...extração... } }    (pronto)
   → { "status": "error", "error": "mensagem" }            (falhou)
```

Aceita 1 ou mais arquivos numa chamada só, representando folhas diferentes do mesmo
conjunto de desenhos. O prompt instrui o modelo a tratá-los como um conjunto único,
cruzar informação entre eles (ex: legenda numa folha + símbolo em outra) e não duplicar
o mesmo componente físico se ele aparecer referenciado em mais de um arquivo. Cada
arquivo é identificado no prompt pelo `name` enviado — use nomes de arquivo
significativos no upload, viram literalmente o texto que a IA usa em `folha_origem`.

O resultado dos jobs fica guardado indefinidamente no store `jobs` do Netlify Blobs
(sem limpeza automática) — não é um problema em uso solo/baixo volume, mas vale saber
que existe caso o Blobs cresça muito com o tempo.

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
