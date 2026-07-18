const PROMPT = `Você é um especialista em leitura de desenhos elétricos de quadros de comando/força
industriais. Analise o(s) desenho(s) anexado(s) (pode ser uma foto ou um PDF com múltiplas
folhas) e extraia a lista de componentes (relés, disjuntores, contatores, chaves), com foco
especial em determinar corretamente o NÚMERO DE POLOS de cada um.

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
é determinável, isso é informação útil por si só.`;

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

async function callGemini(apiKey, file, mimeType) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const geminiBody = {
    contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: file } }] }],
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

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "API key not configured" }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const { file, mimeType } = body;
  if (!file || !mimeType) {
    return Response.json({ error: "Missing file or mimeType" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const parsed = await callGemini(apiKey, file, mimeType);
    return Response.json(parsed, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return Response.json({ error: "Analysis failed", detail: err.message }, { status: 502, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

export const config = {
  method: "POST",
};
