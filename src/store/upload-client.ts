import { ApiClient } from "../utils/api-client";

export class UploadClientApi extends ApiClient {
    constructor(baseURL = '/api') {
        const apiPathUrl = '/upload'
        super(`${baseURL}${apiPathUrl}`);
    }

    // multipart: the file plus a JSON "data" field with the upload metadata
    async uploadFile(token: string, file: File, metadata: { channel: string }) {
        const form = new FormData();
        form.append('file', file);
        form.append('data', JSON.stringify(metadata));
        const { data } = await this.authorized(token).post('', form);
        return data;
    }

    async getUploadProgress(token: string, payload: any) {
        const { data } = await this.authorized(token).post('/progress', payload);
        return data;
    }
}