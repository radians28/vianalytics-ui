import { ApiClient } from "../utils/api-client";
import type { SkuDecision } from "../types/sku-review";

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

    async getSkuReview(token: string, uploadId: string) {
        const { data } = await this.authorized(token).get(`/${uploadId}/sku-review`);
        return data;
    }

    async resolveSkuReview(token: string, uploadId: string, decisions: SkuDecision[]) {
        const { data } = await this.authorized(token).post(`/${uploadId}/sku-review/resolve`, { decisions });
        return data;
    }

    async resumeUpload(token: string, uploadId: string) {
        const { data } = await this.authorized(token).post(`/${uploadId}/resume`);
        return data;
    }
}