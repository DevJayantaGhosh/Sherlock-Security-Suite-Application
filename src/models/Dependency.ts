export interface Dependency {
  id: string;

  name: string;
  description?: string;

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}

export type CreateDependencyPayload = Omit<Dependency, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">;

export type UpdateDependencyPayload = Partial<Dependency>;

export interface PaginationResponse<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
