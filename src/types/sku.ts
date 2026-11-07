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

// POST /api/sku-master/bundles: a bundle SKU with its component breakdown (m_sku_bundle)
export interface SkuBundleComponent {
    seq: number;
    id: number | null;          // component's numeric sku_id
    skuId: string | null;       // component's SKU master code
    sellerSku: string;          // component seller SKU from the bundle file
    productName: string | null;
    qty: number;
    unitPrice: number | null;   // component unit price; 0 for a free gift
    subtotal: number | null;    // unitPrice x qty
    priceRatio: number | null;  // share of the bundle price, in percent
    dqFlags: string[];          // free_gift, equal_split, price_gap, flattened
}

export interface SkuBundleRow {
    id: number;
    skuId: string;
    sellerSku: string | null;
    productName: string;
    componentCount: number;
    totalQty: number;
    bundlePrice: number | null;
    components: SkuBundleComponent[];
}

// POST /api/sku-master/bundles/upload (mode preview | apply)
export interface BundleUploadComponent {
    lineNo: number;
    sellerSku: string;
    productName: string | null;
    skuId: number | null;       // null: registered as a new SKU on apply
    qty: number;
    unitPrice: number | null;
    priceRatio: number;         // percent
    dqFlags: string[];
}

export interface BundleUploadItem {
    skuCode: string;
    productName: string | null;
    skuId: number | null;
    replaces: boolean;          // the bundle already has components, which get replaced
    components: BundleUploadComponent[];
}

export interface BundleUploadReport {
    bundles: number;
    components: number;
    rows: number;
    replacedBundles: number;
    newBundles: number;
    newSkus: { code: string; name: string; role: 'bundle' | 'component'; freeGift?: boolean }[];
    errors: { row: number | null; message: string }[];
    warnings: string[];
    items: BundleUploadItem[];
    // apply only
    created?: { code: string; id: number; skuId: string; role: string }[];
    deletedRows?: number;
    insertedRows?: number;
}
