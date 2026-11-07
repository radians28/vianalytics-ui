const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function formatIdr(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : idr.format(value);
}
