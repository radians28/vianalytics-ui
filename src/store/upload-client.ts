import { ApiClient } from "../utils/api-client";

export class UploadClientApi extends ApiClient {
    constructor(baseURL = '/api') {
        const apiPathUrl = '/upload'
        super(`${baseURL}${apiPathUrl}`);
    }

    async getUploadProgress(token: string, payload: any) {
        const { data } = await this.authorized(token).post('/progress', payload);
        return data;
    }
}