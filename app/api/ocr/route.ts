import { ApiError, FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { z } from "zod";
import {
  EXTRACTION_INSTRUCTIONS,
  invoiceExtractionSchema,
  type OcrResult,
  toExpensePrefill,
} from "@/lib/ocr/expense-extraction";

const MODEL = "gemini-3.8-flash";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

// Gemini accepts a JSON Schema subset without the "$schema" keyword.
const responseJsonSchema: Record<string, unknown> = z.toJSONSchema(invoiceExtractionSchema);
delete responseJsonSchema.$schema;

const BLOCKED_REASONS: string[] = [
  FinishReason.SAFETY,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
  FinishReason.RECITATION,
];

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request): Promise<Response> {
  // Reject oversized uploads before parsing; the multipart envelope adds a little over the file size.
  if (Number(request.headers.get("content-length")) > MAX_BYTES + 64 * 1024) {
    return errorResponse(413, "El archivo supera los 10 MB.");
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return errorResponse(400, "Envía la factura como archivo.");
  }
  if (!(file instanceof File) || file.size === 0) return errorResponse(400, "Selecciona un archivo.");
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return errorResponse(415, "Formato no admitido. Usa PDF, JPG, PNG, GIF o WEBP.");
  }
  if (file.size > MAX_BYTES) return errorResponse(413, "El archivo supera los 10 MB.");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("OCR: GEMINI_API_KEY is not set");
    return errorResponse(503, "El OCR no está configurado. Introduce el gasto a mano.");
  }

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: file.type, data } }, { text: "Extrae los datos de esta factura de gasto." }],
        },
      ],
      config: {
        systemInstruction: EXTRACTION_INSTRUCTIONS,
        responseMimeType: "application/json",
        responseJsonSchema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (response.promptFeedback?.blockReason || (finishReason && BLOCKED_REASONS.includes(finishReason))) {
      console.error("OCR: blocked", response.promptFeedback?.blockReason ?? finishReason);
      return errorResponse(422, "No se pudo procesar este documento. Introduce el gasto a mano.");
    }

    // The schema is requested from the model, but its output is still validated before use.
    let json: unknown;
    try {
      json = JSON.parse(response.text ?? "");
    } catch {
      json = null;
    }
    const parsed = invoiceExtractionSchema.safeParse(json);
    if (!parsed.success) {
      console.error("OCR: invalid model output", finishReason, response.text?.slice(0, 500));
      return errorResponse(502, "No se pudieron extraer los datos. Prueba con una imagen más nítida.");
    }

    const result: OcrResult = toExpensePrefill(parsed.data);
    return Response.json(result);
  } catch (e) {
    if (e instanceof ApiError) {
      console.error("OCR: Gemini API error", e.status, e.message);
      if (e.status === 429) {
        return errorResponse(429, "Se alcanzó el límite gratuito del OCR. Espera un minuto y vuelve a intentarlo.");
      }
      if (e.status === 401 || e.status === 403) {
        return errorResponse(503, "El OCR no está configurado correctamente. Introduce el gasto a mano.");
      }
      if (e.status === 400) {
        return errorResponse(422, "No se pudo leer el archivo. Comprueba que no esté dañado o protegido.");
      }
      return errorResponse(502, "El servicio de OCR no responde. Inténtalo de nuevo.");
    }
    console.error("OCR: unexpected error", e);
    return errorResponse(502, "El servicio de OCR no responde. Inténtalo de nuevo.");
  }
}
