export const PRODUCT_API_URLS = {
  BASE: import.meta.env.VITE_PRODUCT_API_BASE_URL || "http://localhost:9090/api",
  
  PRODUCTS: {
    LIST: "/products",                        // GET /api/products?page=0&size=10
    STATS: "/products/stats",                 // GET /api/products/stats
    OPEN_SOURCE: "/products/opensource",      // GET /api/products/opensource?page=0&size=10
    SINGLE: (id: string) => `/products/${id}`,     //  GET /api/products/{id}
    CREATE: "/products",                           //  POST /api/products
    UPDATE: (id: string) => `/products/${id}`,     //  PUT /api/products/{id}
    DELETE: (id: string) => `/products/${id}`,     //  DELETE /api/products/{id}
    STATUS: (id: string) => `/products/${id}/status`, //  Future endpoint
  },
} as const;
