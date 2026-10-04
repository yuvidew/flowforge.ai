import axios from "axios";

// Shared axios instance for all client-side API calls; paths are relative to /api.
export const api = axios.create({ baseURL: "/api" });
