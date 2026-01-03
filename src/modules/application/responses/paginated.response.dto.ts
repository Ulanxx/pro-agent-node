export class PaginatedResponseDto<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];

  constructor(total: number, page: number, pageSize: number, items: T[]) {
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
    this.items = items;
  }

  static create<T>(
    total: number,
    page: number,
    pageSize: number,
    items: T[],
  ): PaginatedResponseDto<T> {
    return new PaginatedResponseDto<T>(total, page, pageSize, items);
  }
}
