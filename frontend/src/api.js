import axios from "axios";

import { clearSession, getSessionToken } from "./session";
import router from "./router";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getSessionToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearSession();
      if (router.currentRoute.value.path !== "/login") {
        await router.push("/login");
      }
    }
    return Promise.reject(error);
  },
);

export default api;

