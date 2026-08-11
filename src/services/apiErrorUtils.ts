export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "";
  }
};

export const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === "AbortError";

export const isTransientApiError = (error: unknown) => {
  if (isAbortError(error)) return true;
  const message = getErrorMessage(error);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    message
  );
};

export const reportApiError = (error: unknown, options?: { silentTransient?: boolean }) => {
  if (options?.silentTransient && isTransientApiError(error)) return;
  console.error(error);
};
