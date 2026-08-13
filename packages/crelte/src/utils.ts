// This are internal utils. Consider adding them to crelte-std instead

// this tries to do a structuredClone and else just uses JSON
export function objClone(obj: any): any {
	if (typeof structuredClone === 'function') {
		return structuredClone(obj);
	}

	return JSON.parse(JSON.stringify(obj));
}

export function isPromise<T>(p: Promise<T> | T): p is Promise<T> {
	return typeof (p as any)?.then === 'function';
}

/**
 * A helper to chain promises without needing a microtask if its not a promise
 * Equivalent to:
 * ```
 * const val = await p;
 * then(val);
 * ```
 */
export function promiseThen<T, R = void>(
	p: Promise<T> | T,
	then: (val: T) => R,
): Promise<R> | R {
	return isPromise(p) ? p.then(then) : then(p);
}

// the pathname is always replaced
export function urlWithPath(url: string, path?: string): URL {
	const u = new URL(url);
	u.pathname = path ?? '';
	return u;
}

export async function cryptoSha1Hash(str: string): Promise<string> {
	// Convert the string data to an ArrayBuffer
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(str);

	// Use the Web Crypto API to hash the data with SHA-1
	const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);

	const bytes = new Uint8Array(hashBuffer);
	// @ts-ignore using 2025 baseline feature
	if (typeof bytes.toHex === 'function') return bytes.toHex();

	// Convert the ArrayBuffer to a hex string
	const hashArray = Array.from(bytes); // Create an array from the buffer
	const hashHex = hashArray
		.map(b => b.toString(16).padStart(2, '0'))
		.join(''); // Convert to hex string

	return hashHex;
}
