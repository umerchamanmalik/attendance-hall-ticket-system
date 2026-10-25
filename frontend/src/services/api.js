import axios from "axios";

// ✅ Use relative URL when using proxy, or full URL when not
const API_BASE_URL = process.env.REACT_APP_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
});

// ✅ Request interceptor - Add token and progress tracking
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // ✅ Add progress tracking for uploads
    if (config.method === "post" || config.method === "put") {
      config.onUploadProgress = (progressEvent) => {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total,
        );
        if (typeof window !== "undefined") {
          window.uploadProgress = percentCompleted;
          window.dispatchEvent(
            new CustomEvent("uploadProgress", {
              detail: { progress: percentCompleted },
            }),
          );
        }
      };
    }

    console.log(`🌐 ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// ✅ Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => {
    if (typeof window !== "undefined") {
      window.uploadProgress = 100;
      window.dispatchEvent(
        new CustomEvent("uploadProgress", {
          detail: { progress: 100, completed: true },
        }),
      );
    }
    return response;
  },
  (error) => {
    if (typeof window !== "undefined") {
      window.uploadProgress = 0;
      window.dispatchEvent(
        new CustomEvent("uploadProgress", {
          detail: { progress: 0, error: true },
        }),
      );
    }

    let errorMessage = "Something went wrong";
    let errorDetails = [];
    let statusCode = error.response?.status || 500;

    if (error.response) {
      const data = error.response.data;

      if (data.message) {
        errorMessage = data.message;
      }

      if (data.errors && Array.isArray(data.errors)) {
        errorDetails = data.errors;
      } else if (data.error) {
        errorMessage = data.error;
      }

      switch (statusCode) {
        case 400:
          errorMessage =
            errorMessage || "Invalid request. Please check your input.";
          break;
        case 401:
          errorMessage = "Your session has expired. Please login again.";
          break;
        case 403:
          errorMessage = "You don't have permission to perform this action.";
          break;
        case 404:
          errorMessage = "Resource not found. Please refresh and try again.";
          break;
        case 409:
          errorMessage = "Data conflict. The resource already exists.";
          break;
        case 413:
          errorMessage =
            "File too large. Please upload a smaller file (max 5MB).";
          break;
        case 422:
          errorMessage =
            errorMessage || "Validation failed. Please check your input.";
          break;
        case 429:
          errorMessage =
            "Too many requests. Please wait a moment and try again.";
          break;
        case 500:
          errorMessage =
            "Server error. Our team has been notified. Please try again later.";
          break;
        case 503:
          errorMessage = "Service unavailable. Please try again later.";
          break;
        default:
          break;
      }
    } else if (error.request) {
      errorMessage =
        "No response from server. Please check your internet connection.";
    } else {
      errorMessage = error.message || "An unexpected error occurred.";
    }

    const enhancedError = {
      ...error,
      userMessage: errorMessage,
      details: errorDetails,
      statusCode: statusCode,
      isNetworkError: !error.response,
      timestamp: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("apiError", {
          detail: enhancedError,
        }),
      );
    }

    return Promise.reject(enhancedError);
  },
);

// ✅ Helper functions
export const isAuthenticated = () => {
  const token = localStorage.getItem("token");
  return !!token;
};

export const getUploadProgress = () => {
  return typeof window !== "undefined" ? window.uploadProgress || 0 : 0;
};

export const formatErrorMessage = (error) => {
  if (error.userMessage) return error.userMessage;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.error) return error.response.data.error;
  if (error.message) return error.message;
  return "An unexpected error occurred. Please try again.";
};

export const getErrorDetails = (error) => {
  if (error.details && Array.isArray(error.details)) return error.details;
  if (
    error.response?.data?.errors &&
    Array.isArray(error.response.data.errors)
  ) {
    return error.response.data.errors;
  }
  if (error.response?.data?.details) return error.response.data.details;
  return [];
};

export default api;
