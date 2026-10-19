"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="grid justify-items-start gap-3">
      <h1 className="text-xl font-semibold">Algo ha fallado</h1>
      <p className="text-sm text-muted-foreground">
        No se pudieron cargar los datos. Comprueba la conexión e inténtalo de nuevo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
