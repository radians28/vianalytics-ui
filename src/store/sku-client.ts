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
