export async function calcKey(data: any) {
	const json = JSON.stringify(data);
	// this should only happen in an unsecure context
	// specifically in the craft preview locally
	if (!crypto?.subtle) return json;

	// Convert the string data to an ArrayBuffer
	const encoder = new TextEncoder();
	const dataBuffer = encoder.encode(json);

	// Use the Web Crypto API to hash the data with SHA-1
	const hashBuffer = await crypto.subtle.digest('SHA-1', dataBuffer);

	// Convert the ArrayBuffer to a hex string
	const hashArray = Array.from(new Uint8Array(hashBuffer)); // Create an array from the buffer
	const hashHex = hashArray
		.map(b => b.toString(16).padStart(2, '0'))
		.join(''); // Convert to hex string

	return hashHex;
}

/**
 * A simple cache for server side rendering
 *
 * You can use this to store data to pass to the client or to cache data
 * generally. Storing data and retrieving it will also work on the client.
 */
export default class SsrCache {
	private store: Record<string, any>;

	constructor() {
		this.store = {};

		// @ts-ignore
		if (typeof window !== 'undefined' && window.SSR_STORE) {
			// @ts-ignore
			this.store = window.SSR_STORE;
		}
	}

	/**
	 * check if the value is in the cache else calls the fn
	 */
	async load<T>(key: string, fn: () => Promise<T>) {
		if (key in this.store) return this.store[key];
		const v = await fn();
		this.set(key, v);
		return v;
	}

	/**
	 * Get a value from the cache
	 */
	get<T>(key: string): T | null {
		return this.store[key] ?? null;
	}

	/**
	 * Set a value in the cache
	 */
	set<T>(key: string, val: T): T {
		return (this.store[key] = val);
	}

	/** @hidden */
	clear() {
		this.store = {};
	}

	private exportAsJson(): string {
		return JSON.stringify(this.store).replace(/</g, '\\u003c');
	}

	/** @hidden */
	_exportToHead(): string {
		return `\n\t\t<script>window.SSR_STORE = ${this.exportAsJson()};</script>`;
	}
}
