import { ApiClient } from "../utils/api-client";
import type { SkuListPayload } from "../types/sku";

export class SkuClientApi extends ApiClient {
    constructor(baseURL = '/api') {
        const apiPathUrl = '/sku-master'
        super(`${baseURL}${apiPathUrl}`);
    }

    async getSkus(token: string, payload: SkuListPayload) {
        const { data } = await this.authorized(token).post('', payload);
        return data;
    }

    async getBundles(token: string, payload: SkuListPayload) {
        const { data } = await this.authorized(token).post('/bundles', payload);
        return data;
    }

    // mode 'preview' validates only; 'apply' replaces the bundles in the file
    async uploadBundles(token: string, file: File, mode: 'preview' | 'apply', reconsolidate = false) {
        const form = new FormData();
        form.append('file', file);
        form.append('data', JSON.stringify({ mode, reconsolidate }));
        const { data } = await this.authorized(token).post('/bundles/upload', form);
        return data;
    }

    async getBundleChanges(token: string, statuses: string[] = []) {
        const { data } = await this.authorized(token).get('/bundles/changes', { params: { status: statuses.join(',') } });
        return data;
    }

    async reconsolidateBundles(token: string, changeIds: number[] = []) {
        const { data } = await this.authorized(token).post('/bundles/reconsolidate', { changeIds });
        return data;
    }

    async searchSkus(token: string, query: string, limit = 20) {
        const { data } = await this.authorized(token).get('/search', { params: { q: query, limit } });
        return data;
    }

    async getSkuHistory(token: string, skuId: number) {
        const { data } = await this.authorized(token).get(`/${skuId}/history`);
        return data;
    }

    async getSkuPlatforms(token: string, skuId: number) {
        const { data } = await this.authorized(token).get(`/${skuId}/platforms`);
        return data;
    }
}
