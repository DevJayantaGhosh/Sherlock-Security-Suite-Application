import axios, { AxiosError } from "axios";
import { 
  Product, ProductStatsResponse, ProductStatus,
} from "../models/Product";
import { AppUser } from "../models/User";
import { useUserStore } from "../store/userStore";
import { PRODUCT_API_URLS } from "../config/productManagementServiceApiUrls";
import { ApiError } from "../config/ApiError";

const USE_BACKEND = true;  // Toggle flag

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
   IN-MEMORY DB (KEEP ALL YOUR DATA)
====================================================== */
let productDB: Product[] = [
  {
    id: "1",
    name: "Threat Scanner",
    version: "1.2.0",
    isOpenSource: false,
    description: "Automated threat detection and sandboxing engine.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/projectcs23m513/bad-project",
        branch: "test",
      },
    ],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
  {
    id: "sherlock-001",
    name: "Sherlock Security Suite Service With Build",
    version: "1.0.0",
    isOpenSource: true,
    description: "Comprehensive security suite with multiple Spring Boot microservices.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/DevJayantaGhosh/Sherlock-Security-Suite-Services.git",
        branch: "main",
      },
    ],
    dependencies: ["Spring Boot", "MySQL", "Spring Security"],
    createdBy: "u1",
    createdAt: new Date("2024-12-15").toISOString(),
    status: "Pending",
  },
  {
    id: "sherlock-002",
    name: "Sherlock Security Suite",
    version: "1.0.0",
    isOpenSource: true,
    description: "Comprehensive security suite with multiple Spring Boot microservices.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/DevJayantaGhosh/Sherlock-Security-Suite-Services.git",
        branch: "main",
      },
    ],
    dependencies: ["Spring Boot", "MySQL", "Spring Security"],
    createdBy: "u1",
    createdAt: new Date("2024-12-15").toISOString(),
    status: "Approved",
  },
  {
    id: "prod_example_01",
    name: "E-Commerce Payment Gateway",
    version: "2.4.1",
    isOpenSource: false,
    description: "Core payment processing service handling transactions and secure checkout.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3", "u4"],
    repos: [
      {
        repoUrl: "https://github.com/example/payment-gateway-service.git",
        branch: "release/v2.4",
        scans: {
          signatureVerification: {
            status: "success",
            timestamp: "2026-01-26T10:00:00.000Z",
            logs: [
              "Fetching GPG keys from key server...",
              "Verifying 45 commits...",
              "All commits signed by authorized developers."
            ],
            summary: {
              totalCommits: 45,
              goodSignatures: 45
            }
          },
          secretLeakDetection: {
            status: "failed",
            timestamp: "2026-01-26T10:05:00.000Z",
            logs: [
              "Starting Gitleaks scan...",
              "Scanning history...",
              "CRITICAL: Found AWS Access Key in src/config/aws.js"
            ],
            summary: {
              findings: 1
            }
          },
          vulnerabilityScan: {
            status: "success",
            timestamp: "2026-01-26T10:10:00.000Z",
            logs: [
              "Updating Trivy DB...",
              "Scanning package-lock.json...",
              "Scanning pom.xml...",
              "Found 12 vulnerabilities."
            ],
            summary: {
              vulnerabilities: 12,
              critical: 0,
              high: 2,
              medium: 5,
              low: 5
            }
          },
          staticAnalysis: {
            status: "success",
            timestamp: "2026-01-26T10:15:00.000Z",
            logs: [
              "[OPENGREP] Starting scan...",
              "Running with configs: auto, p/owasp-top-ten, p/secrets",
              "Scanned 150 files.",
              "Found 8 issues."
            ],
            summary: {
              totalIssues: 8,
              passedChecks: 150,
              failedChecks: 8
            },
            componentResults: [
              {
                componentName: "Backend Service",
                language: "java",
                issuesCount: 3,
                isPassing: true
              },
              {
                componentName: "Admin Dashboard",
                language: "javascript-typescript",
                issuesCount: 5,
                isPassing: false
              }
            ]
          }
        }
      }
    ],
    dependencies: ["Spring Boot 3.2", "React 18", "PostgreSQL", "Redis"],
    createdBy: "u1",
    createdAt: "2026-01-20T08:30:00.000Z",
    updatedBy: "u3",
    updatedAt: "2026-01-26T10:20:00.000Z",
    status: "Pending",
    remark: "Waiting for Secret Leak remediation before final approval.",
    securityScanReportPath: "https://hashgraph.scan.io",
    signatureFilePath: "/signatures/payment-gateway-v2.4.1.sig",
    publicKeyFilePath: "/keys/payment-gateway-public.asc"
  },
  {
    id: "prod_example_02",
    name: "User Authentication Service",
    version: "3.1.2-beta",
    isOpenSource: true,
    description: "Enterprise-grade authentication service with OAuth2 and JWT support.",
    productDirector: "u1",
    securityHead: "u5",
    releaseEngineers: ["u3", "u6"],
    repos: [
      {
        repoUrl: "https://github.com/example/auth-service.git",
        branch: "develop",
      }
    ],
    dependencies: ["Node.js", "TypeScript", "Redis", "PostgreSQL"],
    createdBy: "u2",
    createdAt: new Date("2026-02-01").toISOString(),
    status: "Approved",
    securityScanReportPath: "https://hashgraph.scan.io",
    signatureFilePath: "/signatures/auth-service-v3.1.2-beta.sig",
    publicKeyFilePath: "/keys/auth-service-public.asc"
  }
];


/* ======================================================
   RBAC FUNCTIONS (UNCHANGED)
====================================================== */
export function authorizeCreate(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === "Admin" || user.role === "ProjectDirector";
}

export function authorizeEdit(user: AppUser | null, product: Product): boolean {
  console.log((user))
  if (!user) return false;
  if (product.status !== "Pending") return false;
  if (user.role === "Admin") return true;
  if (user.role === "ProjectDirector") return product.createdBy === user.email;
  return false;
}

export function authorizeDelete(user: AppUser | null, product: Product): boolean {
  console.log((user))
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
      createdBy: user?.id || "u1",
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

//  5. UPDATE Product (Partial Product)
export async function updateProduct(id: string, payload: Partial<Product>): Promise<{ data: Product; error: ApiError | null }> {
  if (!USE_BACKEND) {
    const product = productDB.find(p => p.id === id);
    if (!product) return { data: {} as Product, error: { message: "Product not found" } };
    
    const user = useUserStore.getState().user;
    if (!authorizeEdit(user, product)) {
      return { data: {} as Product, error: { message: "Unauthorized to edit this product" } };
    }
    
    const idx = productDB.findIndex(p => p.id === id);
    productDB[idx] = { ...productDB[idx], ...payload, updatedAt: new Date().toISOString() };
    return { data: productDB[idx], error: null };
  }

  try {
    const { data } = await api.put<Product>(PRODUCT_API_URLS.PRODUCTS.UPDATE(id), payload);
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
      data: { total: 0, pending: 0, approved: 0, rejected: 0, released: 0, openSource: 0 }, 
      error: createApiError(error as AxiosError, "Failed to fetch product stats") 
    };
  }
}