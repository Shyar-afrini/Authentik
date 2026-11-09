const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Auth ids are Postgres uuids; anything else cannot match a row and must not reach a uuid column. */
export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID.test(value);
}
