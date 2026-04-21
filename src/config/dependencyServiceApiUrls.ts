export const DEPENDENCY_API_URLS = {
  BASE:
    import.meta.env.VITE_PRODUCT_API_BASE_URL ||
    "http://localhost:9090/api/dependencies",

  DEPENDENCIES: {
    LIST: "",
    SINGLE: (id: string) => `/${id}`,
    CREATE: "",
    UPDATE: (id: string) => `/${id}`,
    DELETE: (id: string) => `/${id}`,
  },
};
