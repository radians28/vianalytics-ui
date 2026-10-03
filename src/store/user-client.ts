import { ApiClient } from "../utils/api-client";

export class UserClientApi extends ApiClient {
    

    constructor(baseURL = '/api') {
        const apiPathUrl = '/user';
        super(`${baseURL}${apiPathUrl}`);
    }

    async login(payload: { user_email: string; password: string }) {
        const { data } = await this.client.post('/login', payload);
        return data;
    }

    async registerMember(token: string, payload: { user_email: string, user_first_name: string; user_last_name: string; user_role: string }) {
        const { data } = await this.authorized(token).post('/register', payload);
        return data;
    }

    async getTeamMember(token: string, payload = {}) {
        const { data } = await this.authorized(token).post('', payload);
        return data;
    }

    async updateProfile(token: string, payload: { user_first_name: string; user_last_name: string }) {
        const { data } = await this.authorized(token).patch('/me', payload);
        return data;
    }

    async changePassword(token: string, payload: { current_password: string; new_password: string }) {
        const { data } = await this.authorized(token).post('/change-password', payload);
        return data;
    }

    async changeUserRole(token: string, userId: string, userRole: string) {
        const { data } = await this.authorized(token).patch(`/role/${userId}`, { user_role: userRole });
        return data;
    }

    async deleteUser(token: string, userId: string) {
        const { data } = await this.authorized(token).delete(`/${userId}`);
        return data;
    }

    // Both of these are unauthenticated — the verification link is the
    // credential, there's no logged-in user yet.
    async checkVerificationToken(token: string) {
        const { data } = await this.client.get('/verify', { params: { token } });
        return data;
    }

    async verifyMember(payload: { user_id: string; otp_token: string; password: string }) {
        const { data } = await this.client.post('/verify', payload);
        return data;
    }
}