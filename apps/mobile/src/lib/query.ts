type QueryError = { message: string } | null | undefined;

export function throwIfQueryFailed(label: string, error: QueryError): void {
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
}

export function throwIfAnyQueryFailed(
  results: readonly { label: string; error: QueryError }[],
): void {
  for (const result of results) {
    throwIfQueryFailed(result.label, result.error);
  }
}
