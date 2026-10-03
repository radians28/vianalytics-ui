import axios, { type AxiosInstance } from 'axios';

// Dispatched on `window` whenever the API rejects a request because the
// access token has expired, so parts of the app outside this axios
// instance (e.g. App.tsx) can react by logging the user out.
export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

export class ApiClient {
    baseUrl: string;
    client: AxiosInstance;

    constructor(baseURL = '/api') {
        this.baseUrl = baseURL;
        this.client = axios.create({
            baseURL
        })

        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                const status = error?.response?.status;
                const message = error?.response?.data?.error;
                if (status === 401 && message === 'Token has expired') {
                    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
                }
                return Promise.reject(error);
            },
        );
    }

    protected authorized(token: string) {
        this.client.defaults.headers.common.Authorization = `Bearer ${token}`;
        return this.client;
    }

    
}