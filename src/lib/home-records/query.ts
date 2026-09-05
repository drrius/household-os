export type RecordQuery = Readonly<Record<string, string | undefined>>;
export type RawRecordQuery = Readonly<
  Record<string, string | string[] | undefined>
>;

/** Match URLSearchParams.get when a key occurs more than once. */
export function normalizeRecordQuery(query: RawRecordQuery): RecordQuery {
  return Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
}
