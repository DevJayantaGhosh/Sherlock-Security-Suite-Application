export const REPO_API_URLS = {
  BASE: import.meta.env.VITE_PRODUCT_API_BASE_URL || "http://localhost:9090/api/repos",
  REPOS: {
    LIST: '',
    OPEN_SOURCE: '/opensource',
    CREATE: '',
    SINGLE: (id: string) => `/${id}`,
    UPDATE: (id: string) => `/${id}`,
    DELETE: (id: string) => `/${id}`
  }
};
