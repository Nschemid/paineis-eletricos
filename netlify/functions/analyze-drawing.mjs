const PROMPT = `You are an expert at reading industrial control/power panel electrical drawings.
Analyze the attached file (a photo or a PDF, possibly with multiple pages/sheets) and
extract the list of components (relays, breakers, contactors, switches), with special
focus on correctly determining the NUMBER OF POLES for each one.

This file may be ONE sheet from a larger set of drawings for the same project (other
sheets were or will be analyzed separately) — extract everything identifiable IN THIS
file even if the information seems incomplete without seeing the other sheets (e.g. a
relay with a tag and function but no determinable pole count is a valid, expected result).

The pole count can come from THREE distinct sources — classify each component correctly
in "pole_source":

1. "legend" — the relay legend/BOM table on the drawing itself STATES the pole count
   directly in text. This is rare — usually the legend only gives tag + function
   (e.g. "DCR1 DAMPER CONTROL RELAY"), not the pole count.

2. "symbol" — on single-line power diagrams, the pole count of a breaker/switch is
   determined by visually COUNTING how many phase busbars (N/A/B/C) the breaker symbol
   actually connects to/switches in the drawing. A breaker feeding a three-phase motor
   or VSD typically touches A/B/C (3 poles, no neutral); a breaker feeding a single-phase
   control transformer touches 1 phase + neutral (1 pole).
   WARNING: do not assume the pole count by analogy with neighboring positions in the
   same panel — each symbol must be inspected individually. Spare positions with no
   labeled load are visually distinct from the loaded circuits next to them and often
   have a different pole count than their neighbors. Describe in "evidence" exactly
   which busbars/phases the symbol touches — don't just write "3 poles", write something
   like "touches busbars A/B/C, not N" or "single contact symbol between busbars, no
   labeled load beneath it".
   WARNING 2: a spare breaker with no load is its OWN COMPONENT, with its own symbol
   and its own pole count — even without an associated load label. A short text near it
   (e.g. "N2", "N3") is that breaker's TAG, not an indication that it's connected to the
   neutral conductor — don't confuse a component's label/tag with a busbar/conductor
   name. If you're not sure whether a text is a component tag or a busbar label, say so
   explicitly in "evidence" instead of assuming.

3. "not_available" — the drawing only gives brand/tag/function (e.g. "DCR1 DAMPER
   CONTROL RELAY" or "SIEMENS 3RT20...") WITHOUT a determinable pole count either from
   text or symbol. This is the MOST COMMON case for relays and contactors/overloads —
   it's not an exception, it's the majority of real cases. In these cases, "poles" must
   be 0 and "manufacturer_reference" should contain whatever is available on the drawing
   (even if incomplete/truncated, e.g. "3RT20..."), to allow later cross-referencing
   against a catalog. DO NOT invent or estimate a pole count in these cases — it's
   better to mark it as not available than to risk a wrong number, since this data
   feeds a purchasing decision.

For each component, fill "evidence" with a specific, verifiable description of what was
read on the drawing (exact legend text, or a description of which phases the symbol
touches, or "no pole information on the drawing, only brand X and tag Y") — this field
will be used by a person to double-check and catch visual interpretation errors, so be
concrete and specific, not generic.

If the file has multiple pages/sheets, fill "sheet" with the number or title of the
sheet where each component was found, so the person can go back to exactly that spot
on the drawing.

Return the list of ALL identifiable control/protection components (relays, breakers,
contactors, disconnect switches) — don't skip items just because the pole count isn't
determinable, that's useful information on its own.

VERY IMPORTANT — FULL ENUMERATION, DO NOT SUMMARIZE BY TYPE: this is a materials list
for PURCHASING, so the QUANTITY of each item matters as much as the type. If the
drawing has a legend or table with several relays of the same type in sequence (e.g.
"DCR1" through "DCR16", or "RST1" through "RST11", or "FR1" through "FR11"), you MUST
return ONE SEPARATE COMPONENT FOR EACH INDIVIDUAL TAG (DCR1, DCR2, DCR3, ..., DCR16 —
sixteen distinct entries, not a single "DCR" representing the group). NEVER summarize a
sequence of numbered tags into one representative example — that makes the materials
list underestimate the real purchase quantity. If the same evidence/legend applies to
the whole sequence, repeat the same "evidence" in each entry, but still produce one
entry per tag.

VERY IMPORTANT — BE CONCISE IN EVERY FREE-TEXT FIELD: drawings with many components
(dozens of relays, for example) produce large responses, and very long responses can
exceed the server's execution time. Keep "evidence" to at most 1 short sentence
(ideally under 15 words) — specific enough to check against the drawing, but not
elaborated. Leave "notes" empty unless truly necessary, and "general_notes" to at
most 1-2 sentences. Don't sacrifice full tag enumeration because of this — cut text
length, not item count.

ALSO EXTRACT, WHEN PRESENT — CURRENT RATING AND CABLE SIZE: for breakers/switches, the
label on the drawing or legend very often states an amperage trip rating (e.g. "iC60N
20A", "MCB 32A", "63A"). When this number is explicitly printed on the drawing, fill
"rated_current_a" with it and set "rated_current_source" to "label". If no amperage is
printed anywhere for that component, set "rated_current_a" to 0 and
"rated_current_source" to "not_available" — do not estimate or infer a rating from the
component's apparent size or position. Separately, if the drawing explicitly annotates a
conductor/cable size for that circuit (e.g. "2.5mm²", "4 sqmm", "#10 AWG"), copy that
text verbatim into "drawing_cable_size_mm2" (as a plain number in mm² if the drawing
already uses mm², otherwise leave the original unit text) — leave it empty if the
drawing doesn't state one. These two fields let a downstream tool cross-check the
drawing's own cable size against the breaker rating — don't guess either one.

ALSO EXTRACT, FOR CONTACTORS AND OVERLOAD RELAYS — THE CONNECTED MOTOR LOAD:
a contactor/overload switches a specific motor or load, and the drawing usually
prints that load's power (kW) and/or full load current (FLA, in Amps) directly
below or next to the LOAD symbol/tag it feeds — even though this number is NOT
printed on the contactor's own symbol. Look at what the contactor/overload is
wired to and copy that load's kW and/or FLA into "load_kw" and "load_fla_a" for
that specific contactor/overload row. Set "load_source" to "label" when you
found a printed value this way. If no load rating is visible anywhere near the
circuit, set "load_source" to "not_available" and leave load_kw/load_fla_a at 0
— do not estimate a motor size from the breaker's trip rating or from the
symbol's visual size alone.`;

const responseSchema = {
  type: "OBJECT",
  properties: {
    drawing: {
      type: "OBJECT",
      properties: {
        number: { type: "STRING" },
        title: { type: "STRING" },
        project: { type: "STRING" },
      },
      required: ["number"],
    },
    components: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          tag: { type: "STRING" },
          description: { type: "STRING" },
          component_type: { type: "STRING", enum: ["relay", "breaker", "contactor", "switch", "other"] },
          brand: { type: "STRING" },
          manufacturer_reference: { type: "STRING" },
          poles: { type: "INTEGER" },
          pole_source: { type: "STRING", enum: ["legend", "symbol", "not_available"] },
          evidence: { type: "STRING" },
          confidence: { type: "STRING", enum: ["high", "medium", "low"] },
          sheet: { type: "STRING" },
          notes: { type: "STRING" },
          rated_current_a: { type: "INTEGER" },
          rated_current_source: { type: "STRING", enum: ["label", "not_available"] },
          drawing_cable_size_mm2: { type: "STRING" },
          load_kw: { type: "NUMBER" },
          load_fla_a: { type: "NUMBER" },
          load_source: { type: "STRING", enum: ["label", "not_available"] },
        },
        required: ["tag", "description", "component_type", "pole_source", "poles", "evidence", "confidence", "sheet"],
      },
    },
    general_notes: { type: "STRING" },
  },
  required: ["drawing", "components"],
};

async function callGemini(apiKey, file, mimeType, name) {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

  const geminiBody = {
    contents: [{
      parts: [
        { text: PROMPT + (name ? `\n\nFile name: ${name}` : "") },
        { inlineData: { mimeType, data: file } },
      ],
    }],
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

  const { file, mimeType, name } = body;
  if (!file || !mimeType) {
    return Response.json({ error: "Missing file or mimeType" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const parsed = await callGemini(apiKey, file, mimeType, name);
    return Response.json(parsed, { headers: { "Access-Control-Allow-Origin": "*" } });
  } catch (err) {
    return Response.json({ error: "Analysis failed", detail: err.message }, { status: 502, headers: { "Access-Control-Allow-Origin": "*" } });
  }
}

export const config = {
  method: "POST",
};
