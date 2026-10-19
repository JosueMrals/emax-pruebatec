"use client";

import { useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/money";
import type { OcrResult } from "@/lib/ocr/expense-extraction";

export function OcrUpload({ onResult }: { onResult: (result: OcrResult) => void }) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);

  async function read() {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/ocr", { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? "No se pudo leer la factura.");
        return;
      }
      setResult(json);
      onResult(json);
    } catch {
      setError("No hay conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leer factura con OCR</CardTitle>
        <CardDescription>Sube el PDF o una foto y se rellenarán los campos. Revísalos antes de guardar.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor={id}>Factura (PDF, JPG, PNG o WEBP, máx. 10 MB)</Label>
            <Input
              id={id}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/gif,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button type="button" variant="secondary" disabled={!file || pending} onClick={read}>
            {pending ? "Leyendo…" : "Leer factura"}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && !error && (
          <div role="status" className="grid gap-2 rounded-md bg-muted p-3 text-sm">
            {result.check.ok === true && (
              <p>
                Datos leídos. Base + IVA − IRPF coincide con el total de la factura (
                {formatCents(result.check.totalCents ?? 0)}).
              </p>
            )}
            {result.check.ok === false && (
              <p className="font-medium text-destructive">
                El total de la factura ({formatCents(result.check.totalCents ?? 0)}) no coincide con base + IVA − IRPF (
                {formatCents(result.check.expectedTotalCents ?? 0)}).
              </p>
            )}
            {result.warnings.length > 0 && (
              <ul className="list-disc pl-5">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
