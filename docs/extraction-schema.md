# Schema de extração

Implementado em `netlify/functions/analyze-drawing.mjs` (function síncrona normal). O
prompt completo e o `responseSchema` (dialeto Gemini, tipos em maiúsculo) vivem no
código-fonte da function — este arquivo documenta a forma dos dados pra quem for
consumir o resultado no frontend.

## Um arquivo por chamada, mesclado no cliente

`analyze-drawing.mjs` recebe **um arquivo por vez** (`{file, mimeType, name}`). Quando
a usuária sobe várias folhas juntas, `js/upload.js` chama a function **uma vez por
arquivo, em sequência**, e mescla os `componentes` de todas as respostas no cliente
(`mergeExtractions()`), deduplicando por `tag + tipo_componente` — se o mesmo tag
aparecer em duas folhas, fica só uma entrada, preferindo a versão que já tem `polos`
determinado sobre a `nao_disponivel_no_desenho`.

**Por que não é uma chamada só com todos os arquivos:** foi a primeira tentativa e não
funcionou de forma confiável neste projeto:
- Uma chamada síncrona só com 4 PDFs juntos passa do limite de ~10s de execução de uma
  Netlify Function normal (erro "Inactivity Timeout").
- A alternativa óbvia — rodar como **Background Function** (até 15 min de execução) —
  não chegou a executar de verdade: jobs ficaram presos em "pending" indefinidamente,
  mesmo bem depois da janela de 15 minutos. O mais provável é Background Functions
  serem recurso de plano pago do Netlify, não disponível no free tier usado aqui. Não
  foi possível confirmar pelos logs (sem acesso ao dashboard/CLI no ambiente de
  desenvolvimento), então isso fica registrado como hipótese, não certeza — se o site
  migrar pra um plano pago, vale reconsiderar essa arquitetura pra recuperar o cruzamento
  de informação entre folhas na mesma chamada de IA (ver abaixo).

**Custo dessa decisão:** cada arquivo é analisado isoladamente pela IA — ela não vê as
outras folhas ao processar uma, então não cruza "legenda de relé na folha X" com
"símbolo no diagrama unifilar da folha Y" dentro do mesmo raciocínio. Isso é uma perda
real de precisão em alguns casos, mas ainda assim cada folha extrai corretamente o que
está determinável nela mesma (testado com os 4 desenhos reais do projeto R-MSSB7-ESS).

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
