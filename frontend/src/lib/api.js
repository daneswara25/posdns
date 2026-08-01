import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: API, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pos_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const formatApiError = (detail) => {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && e.msg ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && detail.msg) return detail.msg;
  return String(detail);
};

export const rupiah = (n) =>
  "Rp" + Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

export default api;
