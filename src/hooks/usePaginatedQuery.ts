import { useState, useMemo } from 'react';

const DEFAULT_PAGE_SIZE = 50;

interface UsePaginationOptions {
  pageSize?: number;
}

export function usePagination<T>(data: T[], options?: UsePaginationOptions) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  // Reset to page 1 if data shrinks
  const safePage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return {
    paginatedData,
    currentPage: safePage,
    totalPages,
    pageSize,
    totalItems: data.length,
    setCurrentPage,
    goToNextPage: () => setCurrentPage(p => Math.min(p + 1, totalPages)),
    goToPrevPage: () => setCurrentPage(p => Math.max(p - 1, 1)),
    resetPage: () => setCurrentPage(1),
  };
}
