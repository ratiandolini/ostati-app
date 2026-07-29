import { useEffect, useState } from "react";
import type { Worker } from "../types";
import {
  getDemoWorkerCatalog,
  loadWorkerCatalog,
} from "../services/workerCatalogService";

export const useWorkerCatalog = () => {
  const [workers, setWorkers] = useState<Worker[]>(() => getDemoWorkerCatalog());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    loadWorkerCatalog(controller.signal)
      .then((nextWorkers) => {
        if (cancelled) return;
        setWorkers(nextWorkers);
        setError(null);
        setLoading(false);
      })
      .catch((nextError) => {
        if (cancelled) return;
        if (nextError instanceof DOMException && nextError.name === "AbortError") {
          return;
        }
        setWorkers(getDemoWorkerCatalog());
        setError(
          nextError instanceof Error
            ? nextError.message
            : "ხელოსნების სია ვერ ჩაიტვირთა"
        );
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return { workers, loading, error };
};
