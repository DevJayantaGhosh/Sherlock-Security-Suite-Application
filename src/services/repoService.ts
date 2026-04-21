import axios, { AxiosError } from "axios";
import { Repo } from "../models/Repo";
import { useUserStore } from "../store/userStore";
import { REPO_API_URLS } from "../config/repoServiceApiUrls";
import { ApiError } from "../config/ApiError";

const api = axios.create({
  baseURL: REPO_API_URLS.BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useUserStore.getState().getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const createApiError = (error: AxiosError, defaultMessage: string): ApiError => {
  let message = defaultMessage;
  if (error.response?.data) message = (error.response.data as any).message || defaultMessage;
  else if (error.code === "ECONNABORTED") message = "Request timeout.";
  else if (!navigator.onLine) message = "No internet connection.";
  else message = error.message || defaultMessage;
  return { message, code: (error.response?.data as any)?.code, status: error.response?.status, field: (error.response?.data as any)?.field };
};

export async function getReposPaginated(page: number = 0, size: number = 10) {
  try {
    const { data } = await api.get(REPO_API_URLS.REPOS.LIST, { params: { page, size } });
    return { data, error: null };
  } catch (error) {
    return { data: { items: [], totalItems: 0, currentPage: 0, totalPages: 0, pageSize: 0, hasNext: false, hasPrevious: false }, error: createApiError(error as AxiosError, "Failed to fetch repos") };
  }
}

export async function getOpenSourceReposPaginated(page: number = 0, size: number = 10) {
  try {
    const { data } = await api.get(REPO_API_URLS.REPOS.OPEN_SOURCE, { params: { page, size } });
    return { data, error: null };
  } catch (error) {
    return { data: { items: [], totalItems: 0, currentPage: 0, totalPages: 0, pageSize: 0, hasNext: false, hasPrevious: false }, error: createApiError(error as AxiosError, "Failed to fetch open source repos") };
  }
}

export async function createRepo(payload: Omit<Repo, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) {
  try {
    const { data } = await api.post<Repo>(REPO_API_URLS.REPOS.CREATE, payload);
    return { data, error: null };
  } catch (error) {
    return { data: {} as Repo, error: createApiError(error as AxiosError, "Failed to create repo") };
  }
}

export async function getRepoById(id: string) {
  try {
    const { data } = await api.get(REPO_API_URLS.REPOS.SINGLE(id));
    return { data, error: null };
  } catch (error) {
    return { data: null, error: createApiError(error as AxiosError, "Repo not found") };
  }
}

export async function updateRepo(id: string, payload: Partial<Repo>) {
  try {
    const { data } = await api.put<Repo>(REPO_API_URLS.REPOS.UPDATE(id), payload);
    return { data, error: null };
  } catch (error) {
    return { data: {} as Repo, error: createApiError(error as AxiosError, "Failed to update repo") };
  }
}

export async function deleteRepo(id: string) {
  try {
    await api.delete(REPO_API_URLS.REPOS.DELETE(id));
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: createApiError(error as AxiosError, "Failed to delete repo") };
  }
}
