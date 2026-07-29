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

    setLoading(true);
    loadWorkerCatalog()
      .then((nextWorkers) => {
        if (cancelled) return;
        setWorkers(nextWorkers);
        setError(null);
        setLoading(false);
      })
      .catch((nextError) => {
        if (cancelled) return;
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
    };
  }, []);

  return { workers, loading, error };
};
