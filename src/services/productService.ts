import axios, { AxiosError } from "axios";
import { 
  Product, ProductStatsResponse, ProductStatus,
} from "../models/Product";
import { AppUser } from "../models/User";
import { useUserStore } from "../store/userStore";
import { PRODUCT_API_URLS } from "../config/productManagementServiceApiUrls";
import { ApiError } from "../config/ApiError";

const USE_BACKEND = false;  // Toggle flag

const api = axios.create({
  baseURL: PRODUCT_API_URLS.BASE,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

//  JWT Interceptor
api.interceptors.request.use((config) => {
  if (USE_BACKEND) {
    const token = useUserStore.getState().getToken(); //  GETS FROM STORE
    if (token) config.headers.Authorization = `Bearer ${token}`; //  ADDS JWT
  }
  return config;
});

//  401 Auto-logout
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) useUserStore.getState().clearUser(); //  LOGOUT
    return Promise.reject(error);
  }
);

const createApiError = (error: AxiosError, defaultMessage: string): ApiError => {
  let message = defaultMessage;
  if (error.response?.data) message = (error.response.data as any).message || defaultMessage;
  else if (error.code === "ECONNABORTED") message = "Request timeout.";
  else if (!navigator.onLine) message = "No internet connection.";
  else message = error.message || defaultMessage;
  return { 
    message, 
    code: (error.response?.data as any)?.code, 
    status: error.response?.status, 
    field: (error.response?.data as any)?.field 
  };
};

/* ======================================================
   IN-MEMORY DB — IDs, names & versions regenerated every app launch
====================================================== */
const _uid1 = crypto.randomUUID().slice(0, 8);
const _uid2 = crypto.randomUUID().slice(0, 8);
const _ver = () => `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}`;

let productDB: Product[] = [
  {
    id: `prod-${_uid1}`,
    name: `Threat Scanner-${_uid1}`,
    version: _ver(),
    isOpenSource: false,
    description: "Automated threat detection and sandboxing engine.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/projectcs23m513/bad-project",
        branch: "main",
      },
    ],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
  {
    id: `prod-${_uid2}`,
    name: `Security Analyzer-${_uid2}`,
    version: _ver(),
    isOpenSource: true,
    description: "Comprehensive security analysis and vulnerability scanning platform.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/projectcs23m513/bad-project",
        branch: "main",
      },
    ],
    dependencies: ["Spring Boot", "MySQL", "Spring Security"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
];


/* ======================================================
   RBAC FUNCTIONS (UNCHANGED)
====================================================== */
export function authorizeCreate(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === "Admin" || user.role === "ProjectDirector";
}

export function authorizeEdit(user: AppUser | null, product: Product): boolean {
  if (!user) return false;
  if (product.status !== "Pending") return false;
  if (user.role === "Admin") return true;
  if (user.role === "ProjectDirector") return product.createdBy === user.email;
  return false;
}

export function authorizeDelete(user: AppUser | null, product: Product): boolean {
  if (!user) return false;
  if (product.status !== "Pending") return false;
  if (user.role === "Admin") return true;
  if (user.role === "ProjectDirector") return product.createdBy === user.email;
  return false;
}



// Perform Security Scan & Approve or Reject
export function authorizeApprove(user: AppUser | null, product: Product): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "SecurityHead") return product.securityHead === user.email;
  return false;
}

// Assigned Release Engineer can Sign & Release
export function authorizeToSign(user: AppUser | null, product: Product): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return (
    user.role === "ReleaseEngineer" &&
    product.releaseEngineers.includes(user.email)
  );
}
export function authorizeRelease(user: AppUser | null, product: Product): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  return (
    user.role === "ReleaseEngineer" &&
    product.releaseEngineers.includes(user.email)
  );
}

/* ======================================================
    BACKEND API FUNCTIONS
====================================================== */

//  1. GET ALL Products (Pagination + NEWEST FIRST)
export async function getProductsPaginated(page: number = 0, size: number = 10): Promise<{ 
  data: { 
    items: Product[]; 
    totalItems: number; 
    currentPage: number; 
    totalPages: number; 
    pageSize: number; 
    hasNext: boolean; 
    hasPrevious: boolean 
  }; 
  error: ApiError | null 
}> {
  if (!USE_BACKEND) {
    const start = page * size;
    const end = start + size;
    const items = productDB.slice(start, end);
    const totalItems = productDB.length;
    const totalPages = Math.ceil(totalItems / size);
    return {
      data: { items, totalItems, currentPage: page, totalPages, pageSize: size, hasNext: page < totalPages - 1, hasPrevious: page > 0 },
      error: null,
    };
  }

  try {
    const { data } = await api.get(PRODUCT_API_URLS.PRODUCTS.LIST, { params: { page, size } });
    return { data, error: null };
  } catch (error) {
    return { 
      data: { items: [], totalItems: 0, currentPage: 0, totalPages: 0, pageSize: 0, hasNext: false, hasPrevious: false }, 
      error: createApiError(error as AxiosError, "Failed to fetch products") 
    };
  }
}

//  2. GET Open Source Products (Pagination + NEWEST FIRST)
export async function getOpenSourceProductsPaginated(page: number = 0, size: number = 10): Promise<{ 
  data: { 
    items: Product[]; 
    totalItems: number; 
    currentPage: number; 
    totalPages: number; 
    pageSize: number; 
    hasNext: boolean; 
    hasPrevious: boolean 
  }; 
  error: ApiError | null 
}> {
  if (!USE_BACKEND) {
    const openSource = productDB.filter(p => p.isOpenSource);
    const start = page * size;
    const end = start + size;
    const items = openSource.slice(start, end);
    const totalItems = openSource.length;
    const totalPages = Math.ceil(totalItems / size);
    return {
      data: { items, totalItems, currentPage: page, totalPages, pageSize: size, hasNext: page < totalPages - 1, hasPrevious: page > 0 },
      error: null,
    };
  }

  try {
    const { data } = await api.get(PRODUCT_API_URLS.PRODUCTS.OPEN_SOURCE, { params: { page, size } });
    return { data, error: null };
  } catch (error) {
    return { 
      data: { items: [], totalItems: 0, currentPage: 0, totalPages: 0, pageSize: 0, hasNext: false, hasPrevious: false }, 
      error: createApiError(error as AxiosError, "Failed to fetch open source products") 
    };
  }
}

//  3. CREATE Product (Full Product - No DTO)
export async function createProduct(payload: Product): Promise<{ data: Product; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const user = useUserStore.getState().user;
    if (!authorizeCreate(user)) {
      return { data: {} as Product, error: { message: "Unauthorized to create products" } };
    }

    const newProduct: Product = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: "Pending" as ProductStatus,
      createdBy: user?.email || "unknown",
    };
    productDB.unshift(newProduct);
    return { data: newProduct, error: null };
  }

  try {
    const { data } = await api.post<Product>(PRODUCT_API_URLS.PRODUCTS.CREATE, payload);
    return { data, error: null };
  } catch (error) {
    return { data: {} as Product, error: createApiError(error as AxiosError, "Failed to create product") };
  }
}

//  4. GET Product by ID
export async function getProductById(id: string): Promise<{ data: Product | null; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const product = productDB.find(p => p.id === id);
    return { data: product || null, error: product ? null : { message: "Product not found" } };
  }

  try {
    const { data } = await api.get(PRODUCT_API_URLS.PRODUCTS.SINGLE(id));
    return { data, error: null };
  } catch (error) {
    return { data: null, error: createApiError(error as AxiosError, "Product not found") };
  }
}

//  5. UPDATE Product (Full Product object)
export async function updateProduct(product: Product): Promise<{ data: Product; error: ApiError | null }> {
  const id = product.id;
  const updatedProduct = { ...product, updatedAt: new Date().toISOString() };

  if (!USE_BACKEND) {
    const idx = productDB.findIndex(p => p.id === id);
    if (idx === -1) return { data: {} as Product, error: { message: "Product not found" } };

    // Workflow-driven fields that can be updated regardless of product status
    const workflowFields: (keyof Product)[] = [
      "status", "remark",
      "signatureFilePath", "publicKeyFilePath",
      "securityScanReportPath", "signingReportPath", "releaseReportPath",
    ];

    // Determine which fields actually changed compared to the stored product
    const changedKeys = (Object.keys(updatedProduct) as (keyof Product)[]).filter(
      k => k !== "updatedAt" && JSON.stringify(updatedProduct[k]) !== JSON.stringify(productDB[idx][k])
    );
    const isWorkflowUpdate = changedKeys.every(k => workflowFields.includes(k));

    // For non-workflow edits (e.g. name, version, repos), enforce authorizeEdit
    if (!isWorkflowUpdate) {
      const user = useUserStore.getState().user;
      if (!authorizeEdit(user, productDB[idx])) {
        return { data: {} as Product, error: { message: "Unauthorized to edit this product" } };
      }
    }

    productDB[idx] = updatedProduct;
    return { data: productDB[idx], error: null };
  }

  try {
    const { data } = await api.put<Product>(PRODUCT_API_URLS.PRODUCTS.UPDATE(id), updatedProduct);
    return { data, error: null };
  } catch (error) {
    return { data: {} as Product, error: createApiError(error as AxiosError, "Failed to update product") };
  }
}

//  6. DELETE Product
export async function deleteProduct(id: string): Promise<{ success: boolean; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const product = productDB.find(p => p.id === id);
    if (!product) return { success: false, error: { message: "Product not found" } };
    
    if (useUserStore.getState().user?.role !== "Admin") {
      return { success: false, error: { message: "Only Admin can delete products" } };
    }
    
    productDB = productDB.filter(p => p.id !== id);
    return { success: true, error: null };
  }

  try {
    await api.delete(PRODUCT_API_URLS.PRODUCTS.DELETE(id));
    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: createApiError(error as AxiosError, "Failed to delete product") };
  }
}

//  7. GET Product Stats
export async function getProductStats(): Promise<{ data: ProductStatsResponse; error: ApiError | null }> {
  if (!USE_BACKEND) {
    return {
      data: {
        total: productDB.length,
        pending: productDB.filter(p => p.status === "Pending").length,
        approved: productDB.filter(p => p.status === "Approved").length,
        rejected: productDB.filter(p => p.status === "Rejected").length,
        signed: productDB.filter(p => p.status === "Signed").length,
        released: productDB.filter(p => p.status === "Released").length,
        openSource: productDB.filter(p => p.isOpenSource).length
      },
      error: null
    };
  }

  try {
    const { data } = await api.get(PRODUCT_API_URLS.PRODUCTS.STATS);
    return { data, error: null };
  } catch (error) {
    return { 
      data: { total: 0, pending: 0, approved: 0, rejected: 0, signed:0,released: 0, openSource: 0 }, 
      error: createApiError(error as AxiosError, "Failed to fetch product stats") 
    };
  }
}