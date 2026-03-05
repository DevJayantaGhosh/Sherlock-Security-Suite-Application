import axios, { AxiosError } from "axios";
import { useUserStore } from "../store/userStore";
import { ApiError } from "../config/ApiError";
import { PaginationResponse } from "../models/Dependency";
import { Dependency, CreateDependencyPayload, UpdateDependencyPayload } from "../models/Dependency";
import { DEPENDENCY_API_URLS } from "../config/dependencyServiceApiUrls";

// ====== AXIOS CLIENT + INTERCEPTOR ======
const api = axios.create({
  baseURL: DEPENDENCY_API_URLS.BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useUserStore.getState().getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const createApiError = (
  error: AxiosError,
  defaultMessage: string
): ApiError => {
  let message = defaultMessage;
  if (error.response?.data)
    message =
      (error.response.data as any).message || defaultMessage;
  else if (error.code === "ECONNABORTED")
    message = "Request timeout.";
  else if (!navigator.onLine) message = "No internet connection.";
  else message = error.message || defaultMessage;
  return {
    message,
    code: (error.response?.data as any)?.code,
    status: error.response?.status,
    field: (error.response?.data as any)?.field,
  };
};


// ====== CRUD API CALLS ======
export async function getDependenciesPaginated(
  page: number = 0,
  size: number = 10
) {
  try {
    const { data } = await api.get<PaginationResponse<Dependency>>(
      DEPENDENCY_API_URLS.DEPENDENCIES.LIST,
      { params: { page, size } }
    );
    return { data, error: null } as const;
  } catch (error) {
    return {
      data: {
        items: [],
        totalItems: 0,
        totalPages: 0,
        currentPage: 0,
        pageSize: 0,
        hasNext: false,
        hasPrevious: false,
      },
      error: createApiError(
        error as AxiosError,
        "Failed to fetch dependencies"
      ),
    } as const;
  }
}

export async function getDependencyById(id: string) {
  try {
    const { data } = await api.get<Dependency>(
      DEPENDENCY_API_URLS.DEPENDENCIES.SINGLE(id)
    );
    return { data, error: null } as const;
  } catch (error) {
    return {
      data: null,
      error: createApiError(
        error as AxiosError,
        "Dependency not found"
      ),
    } as const;
  }
}

export async function createDependency(
  payload: CreateDependencyPayload
) {
  try {
    const { data } = await api.post<Dependency>(
      DEPENDENCY_API_URLS.DEPENDENCIES.CREATE,
      payload
    );
    return { data, error: null } as const;
  } catch (error) {
    return {
      data: {} as Dependency,
      error: createApiError(
        error as AxiosError,
        "Failed to create dependency"
      ),
    } as const;
  }
}

export async function updateDependency(
  id: string,
  payload: UpdateDependencyPayload
) {
  try {
    const { data } = await api.put<Dependency>(
      DEPENDENCY_API_URLS.DEPENDENCIES.UPDATE(id),
      payload
    );
    return { data, error: null } as const;
  } catch (error) {
    return {
      data: {} as Dependency,
      error: createApiError(
        error as AxiosError,
        "Failed to update dependency"
      ),
    } as const;
  }
}

export async function deleteDependency(id: string) {
  try {
    await api.delete(DEPENDENCY_API_URLS.DEPENDENCIES.DELETE(id));
    return { success: true, error: null } as const;
  } catch (error) {
    return {
      success: false,
      error: createApiError(
        error as AxiosError,
        "Failed to delete dependency"
      ),
    } as const;
  }
}
