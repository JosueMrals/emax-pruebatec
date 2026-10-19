import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  EXTRACTION_INSTRUCTIONS,
  invoiceExtractionSchema,
  type OcrResult,
  toExpensePrefill,
} from "@/lib/ocr/expense-extraction";

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function errorResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

function fileBlock(file: File, data: string): Anthropic.Beta.BetaContentBlockParam {
  if (file.type === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
  }
  return { type: "image", source: { type: "base64", media_type: file.type as ImageType, data } };
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
  if (file.type !== "application/pdf" && !IMAGE_TYPES.includes(file.type as ImageType)) {
    return errorResponse(415, "Formato no admitido. Usa PDF, JPG, PNG, GIF o WEBP.");
  }
  if (file.size > MAX_BYTES) return errorResponse(413, "El archivo supera los 10 MB.");

  const data = Buffer.from(await file.arrayBuffer()).toString("base64");

  try {
    const client = new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // A safety-classifier decline is retried server-side on Anthropic's recommended model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(invoiceExtractionSchema) },
      system: EXTRACTION_INSTRUCTIONS,
      messages: [
        {
          role: "user",
          content: [fileBlock(file, data), { type: "text", text: "Extrae los datos de esta factura de gasto." }],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return errorResponse(422, "No se pudo procesar este documento. Introduce el gasto a mano.");
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return errorResponse(502, "No se pudieron extraer los datos. Prueba con una imagen más nítida.");
    }

    const result: OcrResult = toExpensePrefill(response.parsed_output);
    return Response.json(result);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      console.error("OCR: invalid Anthropic credentials", e.message);
      return errorResponse(503, "El OCR no está configurado. Introduce el gasto a mano.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      return errorResponse(429, "Demasiadas lecturas seguidas. Espera un momento y vuelve a intentarlo.");
    }
    if (e instanceof Anthropic.BadRequestError) {
      console.error("OCR: bad request", e.message);
      return errorResponse(422, "No se pudo leer el archivo. Comprueba que no esté dañado o protegido.");
    }
    if (e instanceof Anthropic.APIError) {
      console.error("OCR: API error", e.status, e.message);
      return errorResponse(502, "El servicio de OCR no responde. Inténtalo de nuevo.");
    }
    // Missing credentials surface here: the SDK throws before sending any request.
    console.error("OCR: unexpected error", e);
    return errorResponse(503, "El OCR no está disponible. Introduce el gasto a mano.");
  }
}
