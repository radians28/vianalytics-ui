// Shapes returned by the svc /api/sku-master endpoints.

export interface SkuRow {
    id: number;               // numeric sku_id, used in the detail URLs
    skuId: string;            // SKU master code, e.g. SKU-00001
    sellerSku: string | null; // latest seller SKU (golden record)
    productName: string;
}

export interface SkuHistoryRow {
    platformSkuId: number;
    channel: string;
    merchantSku: string;
    version: number;
    oldSellerSku: string | null;
    newSellerSku: string | null;
    skuId: string | null;      // SKU master of this version; null when unknown
    validFrom: string | null;  // ISO 8601, +07:00
    changedAt: string | null;
    dqFlag: string | null;
}

export interface SkuPlatformRow {
    platformSkuId: number;
    channel: string;
    merchantSku: string;
    currentSellerSku: string | null;
    productName: string | null;
    isOnMasterSku: boolean;
    isLatest: boolean;         // newest listing of the SKU on this channel
    firstOrderAt: string | null;
    updatedAt: string | null;
}

export interface SkuListPayload {
    page: number;
    size: number;
    filter?: Record<string, string>;
    sort?: Record<string, 'asc' | 'desc'>;
}
