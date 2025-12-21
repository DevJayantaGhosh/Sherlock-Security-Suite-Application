import axios from "axios";

/**
 * Base axios instance for ALL backend API calls.
 * Change baseURL when your real backend is deployed.
 */

export const api = axios.create({
  baseURL: "http://localhost:3000/api",

  timeout: 10000,

  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Optional interceptor for debugging / auth headers
 * Safe to keep in project for future use
 */

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Example:
    // const token = localStorage.getItem("token");
    // if (token) config.headers.Authorization = `Bearer ${token}`;

    console.log("API request:", config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API error:", error?.response || error);

    return Promise.reject(error);
  }
);
