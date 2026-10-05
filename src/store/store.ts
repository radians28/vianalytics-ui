import { create } from "zustand";
import { UserClientApi } from "./user-client";
import { UploadClientApi } from "./upload-client";

// Built images set VITE_API_BASE_URL=/api (nginx proxies it to the svc);
// local `pnpm dev` falls back to the svc running on port 3000.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

const userClient = new UserClientApi(apiBaseUrl);
const uploadClient = new UploadClientApi(apiBaseUrl);

export interface UserStore {
    login: (userEmail: string, userPass: string) => Promise<any | null>;
    getTeamMembers: (token: string, payload: any) => Promise<void>;
    registerMember: (
        token: string,
        payload: { user_email: string; user_first_name: string; user_last_name: string; user_role: string }
    ) => Promise<{ otp: string }>;
    checkVerificationToken: (token: string) => Promise<{ user_id: string; user_email: string; user_first_name: string }>;
    verifyMember: (
        payload: { user_id: string; otp_token: string; password: string }
    ) => Promise<{ access_token: string; decoded_token: Record<string, unknown> }>;
    updateProfile: (
        token: string,
        payload: { user_first_name: string; user_last_name: string }
    ) => Promise<{ access_token: string; decoded_token: Record<string, unknown> }>;
    changePassword: (
        token: string,
        payload: { current_password: string; new_password: string }
    ) => Promise<void>;
    changeUserRole: (token: string, userId: string, userRole: string) => Promise<void>;
    deleteUser: (token: string, userId: string) => Promise<void>;

    getProgressUpload: (token: string, payload: any) => Promise<void>;

    setJobs: (jobs: any[] | ((prev: any[]) => any[])) => void;

    members: any[];
    totalMembers: number;

    totalJobs: number;
    jobs: any[]
}

const useStore = create<UserStore>((set, get) => ({
    members: [],
    totalMembers: 0,

    totalJobs: 0,
    jobs: [],

    async login(userEmail: string, userPass: string) {
        try {
            const { data } = await userClient.login({
                user_email: userEmail,
                password: userPass,
            });
            return data
        } catch (err) {
            console.error(err)
            return null;
        }
    },

    async getTeamMembers(token: string, payload: any) {
        try {
            const { data: { records, total_count: totalCount } } = await userClient.getTeamMember(token, payload);
            set({ members: records, totalMembers: totalCount })
        } catch (err) {
            console.error(err);
        }
    },

    // Unlike the methods above, this intentionally does NOT swallow errors:
    // the Add Team Member drawer needs the real validation/conflict message
    // (e.g. "already registered") to show the user, not just a console log.
    async registerMember(token, payload) {
        const { data } = await userClient.registerMember(token, payload);
        return data;
    },

    // Also does not swallow errors — the verification page needs to
    // distinguish "invalid token" from "already verified" etc.
    async checkVerificationToken(token) {
        const { data } = await userClient.checkVerificationToken(token);
        return data;
    },

    async verifyMember(payload) {
        const { data } = await userClient.verifyMember(payload);
        return data;
    },

    // Neither of these swallow errors — the Settings drawer needs to show
    // the real message (e.g. "Current password is incorrect").
    async updateProfile(token, payload) {
        const { data } = await userClient.updateProfile(token, payload);
        return data;
    },

    async changePassword(token, payload) {
        await userClient.changePassword(token, payload);
    },

    // Neither swallows errors — TeamView needs to show the real reason a
    // change was rejected (e.g. "You cannot change your own role").
    async changeUserRole(token, userId, userRole) {
        await userClient.changeUserRole(token, userId, userRole);
    },

    async deleteUser(token, userId) {
        await userClient.deleteUser(token, userId);
    },

    async getProgressUpload(token, payload) {
        const { data, meta: { total }} = await uploadClient.getUploadProgress(token, payload);
        set({ jobs: data, totalJobs: total });
    },

    // Accepts an array or a React-style updater, e.g. setJobs(prev => [...])
    setJobs(jobs) {
        const next = typeof jobs === 'function' ? jobs(get().jobs) : jobs;
        set({ jobs: next, totalJobs: next.length })
    },
}));

export default useStore;