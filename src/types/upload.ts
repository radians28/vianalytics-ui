// Shapes returned by the svc /api/upload endpoints.

export interface UploadJob {
    id: string;
    fifoOrder?: number | null;
    fileName: string;
    marketplace: string;
    size: string;
    recordsSummary: string;
    status: 'Processing' | 'Paused' | 'Queued' | 'Completed' | 'Failed';
    statusDetail?: string;
    timestamp: string;
}

// POST /api/upload/traffic
export interface TrafficUploadResult {
    channel: string;
    rows: number;
    days: number;
    periodStart: string;   // YYYY-MM-DD
    periodEnd: string;
    inserted: number;      // days new to t_traffic
    updated: number;       // days that replaced an earlier upload
    skipped: { row: number; reason: string }[];
    warnings: string[];
}
