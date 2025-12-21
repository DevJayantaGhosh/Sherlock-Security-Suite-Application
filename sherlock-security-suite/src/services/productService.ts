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
    description: "Automated threat detection and sandboxing engine.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/example/threat-scanner",
        branch: "main",
        componentConfigs: [
          {
            language: "java",
            buildCommand: "mvn clean compile -DskipTests",
            workingDirectory: "",
          },
          {
            language: "c-cpp",
            buildCommand: "cmake --build build",
            workingDirectory: "native-module",
          },
        ],
      },
    ],
    dependencies: ["Node", "Express", "Docker"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
  {
    id: "2",
    name: "Sherlock Security Suite",
    version: "1.2.0",
    description: "Comprehensive security suite with multiple microservices.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl:
          "https://github.com/DevJayantaGhosh/Sherlock-Security-Suite-Services.git",
        branch: "main",
        componentConfigs: [
          {
            language: "java",
            buildCommand: "mvn clean compile -DskipTests",
            workingDirectory: "", // Root - multi-module Maven
          },
        ],
      },
    ],
    dependencies: ["Spring Boot", "MongoDB", "Redis"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
  {
    id: "3",
    name: "File Upload Service",
    version: "1.2.0",
    description: "Large file upload POC with chunking support.",
    productDirector: "u1",
    securityHead: "u2",
    releaseEngineers: ["u3"],
    repos: [
      {
        repoUrl: "https://github.com/DevJayantaGhosh/large-fileupload-poc.git",
        branch: "main",
        componentConfigs: [
          {
            language: "javascript-typescript",
            buildCommand: "npm run build",
            workingDirectory: "",
          },
        ],
      },
    ],
    dependencies: ["Node", "Express", "AWS S3"],
    createdBy: "u1",
    createdAt: new Date().toISOString(),
    status: "Pending",
  },
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
