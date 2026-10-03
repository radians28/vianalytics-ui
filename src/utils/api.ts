import axios from 'axios';

// The backend's error_response() body shape is {success, message, ...}.
export function extractErrorMessage(err: unknown, fallback: string): string {
  return (axios.isAxiosError<{ message?: string }>(err) ? err.response?.data?.message : undefined) || fallback;
}
