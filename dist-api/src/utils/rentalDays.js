/**
 * Rental day math for date-only pickers.
 * Each billed day represents a full 24-hour window from pickup time.
 * With date-only inputs we treat the span as ceil(hours / 24), minimum 1 day when end > start.
 */
export function calculateRentalDays(startDate, endDate) {
    if (!startDate || !endDate)
        return 0;
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return 0;
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0)
        return 0;
    return Math.max(1, Math.ceil(diffMs / msPerDay));
}
export function calculateRentalTotal(dailyRate, days) {
    const safeDays = Number.isFinite(days) && days > 0 ? days : 0;
    const rate = Number(dailyRate || 0);
    return Math.round(rate * safeDays);
}
