export function parseIdParam(value: string): number | null {
  const id = parseInt(value, 10);
  return isNaN(id) ? null : id;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  totalPages: number;
  page: number;
}

/** Parse ?page/?limit into safe bounds and an offset. */
export function parsePageParams(page = '1', limit = '10') {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 10);
  return { page: pageNum, limit: limitNum, offset: (pageNum - 1) * limitNum };
}

/** Wrap a page of rows in the standard list envelope. */
export function paginated<T>(data: T[], total: number, page: number, limit: number): Paginated<T> {
  return { data, total, totalPages: Math.ceil(total / limit), page };
}
