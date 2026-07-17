/** Normalize Supabase storage download payloads to a Node Buffer. */
export async function storageDownloadToBuffer(data) {
    if (!data)
        return Buffer.from([]);
    if (Buffer.isBuffer(data)) {
        return data;
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
    }
    if (data instanceof Uint8Array) {
        return Buffer.from(data);
    }
    const blob = data;
    if (typeof blob.arrayBuffer === 'function') {
        return Buffer.from(await blob.arrayBuffer());
    }
    if (typeof data.text === 'function') {
        const text = await data.text();
        return Buffer.from(text);
    }
    return Buffer.from([]);
}
