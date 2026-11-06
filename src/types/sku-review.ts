// Shapes of the svc SKU review endpoints (/api/upload/<id>/sku-review, /resume).

export interface SkuCandidate {
    id: number;                // numeric sku_id, sent back as skuId when mapping
    skuId: string;             // SKU master code, e.g. SKU-00001
    sellerSku: string | null;  // latest seller SKU of that SKU
    productName: string;
    score: number | null;      // name similarity 0..1
}

export interface SkuReviewItem {
    matchId: number;
    status: 'PENDING' | 'MAPPED' | 'CREATED_NEW';
    channel: string;
    merchantSku: string;       // platform SKU (Shopee: SHP_ + hash of name|variation)
    sellerSku: string | null;  // as in the order file
    skuCode: string | null;    // cleaned seller SKU
    productName: string | null;
    variation: string | null;
    orderLineCount: number | null;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    candidates: SkuCandidate[];
    resolved: {
        id: number;
        skuId: string;
        productName: string;
        by: string | null;
        at: string | null;
    } | null;
}

export interface SkuReviewUpload {
    id: string;
    fileName: string;
    channel: string;
    marketplace: string;
    status: string;
    totalRows: number | null;
    createdAt: string | null;
    pending: number;
    resumeError: string | null;  // set when the decisions are saved but the ETL could not resume
}

export interface SkuReview {
    upload: SkuReviewUpload;
    items: SkuReviewItem[];
}

export type SkuDecision =
    | { matchId: number; action: 'map'; skuId: number }
    | { matchId: number; action: 'create'; productName?: string };

export interface ResumeResult {
    triggered: boolean;
    dagId: string;
    dagRunId?: string;
    error?: string;
}

export interface ResolveResult {
    mapped: number;
    created: { matchId: number; id: number; skuId: string }[];
    resume: ResumeResult;
    uploadStatus: string;
}
