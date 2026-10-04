import { isAxiosError } from "axios";

// Reads the `{ error }` message our route handlers return, falling back to a generic string.
export const getErrorMessage = (error: unknown, fallback: string) =>
  isAxiosError<{ error?: string }>(error) && error.response?.data?.error
    ? error.response.data.error
    : fallback;
