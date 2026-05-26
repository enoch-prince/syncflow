"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareVectorClocks = compareVectorClocks;
function compareVectorClocks(a, b) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let aGreater = false;
    let bGreater = false;
    for (const key of keys) {
        const va = a[key] || 0;
        const vb = b[key] || 0;
        if (va > vb)
            aGreater = true;
        if (vb > va)
            bGreater = true;
    }
    if (aGreater && bGreater)
        return 'concurrent';
    if (aGreater)
        return 'after';
    if (bGreater)
        return 'before';
    return 'equal';
}
//# sourceMappingURL=vector-clock.js.map