export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  status?: number;
}
