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
    affectedLines: number;      // order lines already loaded with this bundle
    components: BundleUploadComponent[];
}

export interface BundleUploadReport {
    bundles: number;
    components: number;
    rows: number;
    replacedBundles: number;
    newBundles: number;
    affectedLines: number;      // order lines already loaded with the file's bundles
    newSkus: { code: string; name: string; role: 'bundle' | 'component'; freeGift?: boolean }[];
    errors: { row: number | null; message: string }[];
    warnings: string[];
    items: BundleUploadItem[];
    // apply only
    created?: { code: string; id: number; skuId: string; role: string }[];
    deletedRows?: number;
    insertedRows?: number;
    changedBundles?: number;    // bundles whose component list changed (log_bundle_change rows)
    reconsolidate?: { triggered: boolean; changeIds: number[]; error?: string } | null;
}

// GET /api/sku-master/bundles/changes: a bundle's component change and its order re-split state
export interface BundleChange {
    changeId: number;
    runId: number;
    id: number;
    skuId: string;
    sellerSku: string | null;
    productName: string;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'SKIPPED';
    newBundle: boolean;
    components: number;
    linesRebuilt: number | null;
    linesMismatch: number | null;
    ordersTouched: number | null;
    message: string | null;
    createdAt: string;
    processedAt: string | null;
    fileName: string | null;
    by: string | null;
}

// ------------------------------------------------------------------ merge / split (svc sku_change.py)

// GET /api/sku-master/<id>/composition: what a split can move, with the order lines that follow each
export interface SkuComposition {
    sku: SkuRow;
    codes: { code: string; isMasterCode: boolean; firstSeenAt: string | null; orderLines: number }[];
    listings: {
        platformSkuId: number;
        channel: string;
        merchantSku: string;
        productName: string | null;
        currentSellerSku: string | null;
        orderLines: number;
    }[];
    bundleComponents: number;
    merging: boolean;
}

// GET /api/sku-master/<id>/merge-suggestions: SKUs most like this one (same scoring as the SKU review)
export interface MergeSuggestion extends SkuRow {
    matchedName: string;
    score: number;
    cosine: number | null;
    factors: Record<'species' | 'stage' | 'size' | 'qty', number>;
}

// POST /api/sku-master/<id>/merge | split (mode preview or apply)
export interface SkuChangeResult {
    kind: 'MERGE' | 'SPLIT';
    source: SkuRow;
    target: { id: number | null; skuId: string; sellerSku: string | null; productName: string };
    deletes?: string;
    counts: {
        codes: number;
        listings: number;
        historyRows: number;
        orderLines: number;
        componentOfBundles?: number;
        bundle: string | null;
    };
    changeId?: number;
    reassign?: { triggered: boolean; dagId: string; error?: string };
}

export type SplitTarget = { skuId: number } | { new: { productName: string } };

// GET /api/sku-master/changes
export interface SkuChange {
    changeId: number;
    kind: 'MERGE' | 'SPLIT';
    source: string;
    target: string;
    targetCreated: boolean;
    codes: number;
    listings: number;
    status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
    counts: Record<string, number> | null;
    message: string | null;
    by: string | null;
    createdAt: string;
    finishedAt: string | null;
}
