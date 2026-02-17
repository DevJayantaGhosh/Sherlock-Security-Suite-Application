import { Product, ProductStatus } from "../models/Product";
import { AppUser } from "../models/User";
import { api } from "./productServiceApi";

/* ======================================================
   IN-MEMORY DB
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
    signatureFilePath: "/signatures/auth-service-v3.1.2-beta.sig",
    publicKeyFilePath: "/keys/auth-service-public.asc"
  }
];

/* ======================================================
   API STUBS
====================================================== */

export const apiGetProducts = async () =>
  api.get<Product[]>("/products").then((r) => r.data);

export const apiCreateProduct = async (payload: Product) =>
  api.post<Product>("/products", payload);

export const apiUpdateProduct = async (id: string, payload: Product) =>
  api.put<Product>(`/products/${id}`, payload);

export const apiDeleteProduct = async (id: string) =>
  api.delete(`/products/${id}`);

/* ======================================================
   LOCAL CRUD
====================================================== */

export function getProducts(): Product[] {
  return [...productDB];
}

export function createProduct(
  payload: Omit<Product, "id" | "createdAt">
): Product {
  const newProduct: Product = {
    ...payload,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: payload.status ?? "Pending",
  };

  // ✅ ACTUAL INSERT
  productDB.unshift(newProduct);

  return newProduct;
}

export function updateProduct(product: Product): Product {
  const idx = productDB.findIndex((p) => p.id === product.id);
  if (idx === -1) throw new Error("Product not found");

  productDB[idx] = {
    ...product,
    updatedAt: new Date().toISOString(),
  };

  return productDB[idx];
}

export function deleteProduct(id: string) {
  productDB = productDB.filter((p) => p.id !== id);
}

export function updateStatus(
  id: string,
  status: ProductStatus,
  byUserId: string,
  note?: string
) {
  const p = productDB.find((x) => x.id === id);
  if (!p) throw new Error("Product not found");

  p.status = status;
  p.updatedAt = new Date().toISOString();
  p.updatedBy = byUserId;
  
  // Store note in remark field
  if (note) {
    p.remark = note;
  }
}

/* ======================================================
   RBAC
====================================================== */

export function authorizeApprove(
  user: AppUser | null,
  product: Product
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "SecurityHead") return product.securityHead === user.id;
  return false;
}

export function authorizeCreate(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === "Admin" || user.role === "ProjectDirector";
}

export function authorizeEdit(user: AppUser | null, product: Product): boolean {
  if (!user) return false;
  if (product.status !== "Pending") return false;

  if (user.role === "Admin") return true;

  if (user.role === "ProjectDirector") return product.createdBy === user.id;

  return false;
}

export function authorizeRelease(
  user: AppUser | null,
  product: Product
): boolean {
  if (!user) return false;
  if (user.role === "Admin") return true;

  return (
    user.role === "ReleaseEngineer" &&
    product.releaseEngineers.includes(user.id)
  );
}
