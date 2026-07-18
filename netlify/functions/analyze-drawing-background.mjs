import { getStore } from "@netlify/blobs";

const PROMPT = `Você é um especialista em leitura de desenhos elétricos de quadros de comando/força
industriais. Analise o(s) desenho(s) anexado(s) — pode ser um único arquivo (foto ou PDF com
múltiplas folhas) ou VÁRIOS ARQUIVOS enviados juntos representando folhas diferentes do MESMO
conjunto de desenhos de um projeto (ex: um arquivo com o diagrama de força/unifilar, outro com
o diagrama de fiação de controle, outro com a legenda de relés). Cada arquivo é precedido por
um marcador de texto "--- Arquivo N: <nome> ---" indicando seu nome original — use esse nome
(ou parte dele) para preencher "folha_origem", e trate os arquivos como um conjunto único e
coerente: uma legenda de relé num arquivo pode ter seu símbolo/contagem de polos determinável
no diagrama unifilar de outro arquivo, e vice-versa — cruze essa informação entre os arquivos
sempre que possível antes de decidir "fonte_polos". Extraia a lista de componentes (relés,
disjuntores, contatores, chaves), com foco especial em determinar corretamente o NÚMERO DE
POLOS de cada um, evitando duplicar o mesmo componente físico se ele aparecer referenciado em
mais de um arquivo (ex: mesmo tag citado na legenda de um arquivo e no unifilar de outro —
isso é UM componente só, não dois).

O número de polos pode vir de TRÊS fontes distintas — classifique cada componente
corretamente em "fonte_polos":

1. "bom" — a legenda/tabela de relés ou lista de materiais no próprio desenho ESTABELECE
   o polos diretamente em texto. Isso é raro — normalmente a legenda só dá tag + função
   (ex: "DCR1 DAMPER CONTROL RELAY"), não o número de polos.

2. "simbolo" — em diagramas unifilares de força, o número de polos de um disjuntor/chave
   é determinado CONTANDO visualmente quantas barras de fase (N/A/B/C) o símbolo do
   disjuntor efetivamente conecta/comuta no desenho. Um disjuntor alimentando um motor ou
   VSD trifásico normalmente toca A/B/C (3 polos, sem neutro); um disjuntor alimentando um
   transformador de comando monofásico toca 1 fase + neutro (1 polo).
   ATENÇÃO: não assuma o número de polos por analogia com posições vizinhas no mesmo
   quadro — cada símbolo deve ser inspecionado individualmente. Posições de reserva
   (spare) sem rótulo de carga são visualmente distintas dos circuitos carregados ao
   lado e frequentemente têm um número de polos diferente dos vizinhos. Descreva em
   "evidencia" exatamente quais barras/fases o símbolo toca — não escreva apenas "3 polos",
   escreva algo como "toca barras A/B/C, não toca N" ou "único símbolo de contato entre as
   barras, sem carga rotulada embaixo".
   ATENÇÃO 2: um disjuntor de reserva (spare) sem carga é um COMPONENTE PRÓPRIO, com seu
   próprio símbolo e seu próprio polos — mesmo sem rótulo de carga associado. Um texto
   curto perto dele (ex: "N2", "N3") é o TAG desse disjuntor, não uma indicação de que
   ele está ligado ao condutor neutro — não confunda a etiqueta/tag de um componente com
   o nome de uma barra ou condutor. Se não tiver certeza se um texto é tag de componente
   ou rótulo de barra, diga isso explicitamente em "evidencia" em vez de assumir.

3. "nao_disponivel_no_desenho" — o desenho dá apenas marca/tag/função (ex: "DCR1 DAMPER
   CONTROL RELAY" ou "SIEMENS 3RT20...") SEM número de polos determinável nem por texto
   nem por símbolo. Isso é o caso MAIS COMUM para relés e contatores/sobrecargas — não é
   exceção, é a maioria dos casos reais. Nestes casos, "polos" deve ser 0 e
   "referencia_fabricante" deve conter o que estiver disponível no desenho (mesmo que
   incompleto/truncado, ex: "3RT20..."), para permitir cruzamento posterior com catálogo.
   NÃO invente ou estime um número de polos nesses casos — é preferível marcar como não
   disponível do que arriscar um número errado, já que essa informação alimenta decisão
   de compra.

Para cada componente, preencha "evidencia" com uma descrição específica e verificável
do que foi lido no desenho (texto exato da legenda, ou descrição de quais fases o
símbolo toca, ou "nenhuma informação de polos no desenho, apenas marca X e tag Y") —
este campo será usado por uma pessoa para conferir e pegar erros de interpretação visual,
então seja concreto e específico, não genérico.

Se o arquivo tiver múltiplas folhas/páginas, preencha "folha_origem" com o número ou
título da folha onde cada componente foi encontrado, para permitir voltar exatamente
naquele ponto do desenho.

Retorne a lista de TODOS os componentes de comando/proteção identificáveis (relés,
disjuntores, contatores, chaves seccionadoras) — não pule itens só porque o polos não
é determinável, isso é informação útil por si só.

MUITO IMPORTANTE — ENUMERAÇÃO COMPLETA, NÃO RESUMO POR TIPO: isto é uma lista de
materiais para COMPRA, então a QUANTIDADE de cada item importa tanto quanto o tipo. Se o
desenho tem uma legenda ou tabela com vários relés do mesmo tipo em sequência (ex:
"DCR1" até "DCR16", ou "RST1" até "RST11", ou "FR1" até "FR11"), você DEVE retornar UM
COMPONENTE SEPARADO PARA CADA TAG INDIVIDUAL (DCR1, DCR2, DCR3, ..., DCR16 — dezesseis
entradas distintas, não uma só "DCR" representando o grupo). NUNCA resuma uma sequência
de tags numerados em um único exemplo representativo — isso faz a lista de materiais
subestimar a quantidade real a comprar. Se a mesma evidência/legenda se aplica a toda a
sequência, repita a mesma "evidencia" em cada entrada, mas ainda assim gere uma entrada
por tag.`;

const responseSchema = {
  type: "OBJECT",
  properties: {
    desenho: {
      type: "OBJECT",
      properties: {
        numero: { type: "STRING" },
        titulo: { type: "STRING" },
        projeto: { type: "STRING" },
      },
      required: ["numero"],
    },
    componentes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tag: { type: "STRING" },
          descricao: { type: "STRING" },
          tipo_componente: { type: "STRING", enum: ["rele", "disjuntor", "contator", "chave", "outro"] },
          fabricante_marca: { type: "STRING" },
          referencia_fabricante: { type: "STRING" },
          polos: { type: "INTEGER" },
          fonte_polos: { type: "STRING", enum: ["bom", "simbolo", "nao_disponivel_no_desenho"] },
          evidencia: { type: "STRING" },
          confianca: { type: "STRING", enum: ["alta", "media", "baixa"] },
          folha_origem: { type: "STRING" },
          observacoes: { type: "STRING" },
        },
        required: ["tag", "descricao", "tipo_componente", "fonte_polos", "polos", "evidencia", "confianca", "folha_origem"],
      },
    },
    notas_gerais: { type: "STRING" },
  },
  required: ["desenho", "componentes"],
};

async function callGemini(apiKey, files) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const parts = [{ text: PROMPT }];
  files.forEach((f, i) => {
    parts.push({ text: `\n--- Arquivo ${i + 1}: ${f.name || "sem nome"} ---` });
    parts.push({ inlineData: { mimeType: f.mimeType, data: f.file } });
  });

  const geminiBody = {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  };

  let res = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

  if (!res.ok && res.status === 400) {
    delete geminiBody.generationConfig.responseSchema;
    res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text);
}

// Netlify Background Function: classic handler(event, context) signature.
// The platform responds 202 to the caller immediately and lets this run
// for up to 15 minutes — needed because analyzing several PDF sheets in one
// Gemini call routinely exceeds the ~10s limit of a normal sync function.
//
// The invocation payload itself is capped at 256KB (Lambda async invoke limit),
// which a single drawing photo/PDF can already exceed and multiple definitely
// do — so this function does NOT receive file bytes directly. The client
// stages each file in the "uploads" Blobs store via upload-file.mjs first and
// only sends { jobId, fileCount } here; this function reads the bytes back by
// key, well within its own 15-minute execution budget.
export async function handler(event) {
  const jobs = getStore("jobs");
  const uploads = getStore("uploads");
  let jobId, fileCount;

  try {
    const body = JSON.parse(event.body || "{}");
    jobId = body.jobId;
    fileCount = body.fileCount;
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (!jobId || !fileCount) {
    return { statusCode: 400, body: "Missing jobId or fileCount" };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    await jobs.set(jobId, JSON.stringify({ status: "error", error: "API key not configured" }));
    return { statusCode: 200, body: "" };
  }

  try {
    const files = [];
    for (let i = 0; i < fileCount; i++) {
      const raw = await uploads.get(`${jobId}:${i}`);
      if (!raw) throw new Error(`Arquivo ${i} não encontrado no armazenamento temporário`);
      files.push(JSON.parse(raw));
    }

    const result = await callGemini(apiKey, files);
    await jobs.set(jobId, JSON.stringify({ status: "done", result, finished_at: new Date().toISOString() }));

    for (let i = 0; i < fileCount; i++) {
      await uploads.delete(`${jobId}:${i}`);
    }
  } catch (err) {
    await jobs.set(jobId, JSON.stringify({ status: "error", error: err.message, finished_at: new Date().toISOString() }));
  }

  return { statusCode: 200, body: "" };
}
