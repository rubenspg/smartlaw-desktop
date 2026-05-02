export function parseIdParam(value: string): number | null {
  const id = parseInt(value, 10);
  return isNaN(id) ? null : id;
}
