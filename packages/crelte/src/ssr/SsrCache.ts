/**
 * Calculates a key based on the json representation of the data
 *
 * If available hashes the data using SHA-1
 */
export async function calcKey(data: any): Promise<string> {
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
	private store: Map<string, any>;

	constructor() {
		this.store = new Map();
	}

	/**
	 * Check if a key exists in the cache
	 */
	has(key: string): boolean {
		return this.store.has(key);
	}

	/**
	 * Get a value from the cache
	 */
	get<T>(key: string): T | null {
		return this.store.get(key) ?? null;
	}

	/**
	 * Set a value in the cache
	 */
	set<T>(key: string, val: T): T {
		this.store.set(key, val);
		return val;
	}

	/**
	 * check if the value is in the cache else calls the fn
	 *
	 * See also {@link getOrInsertLoaded}
	 */
	getOrInsertComputed<T>(key: string, fn: () => T): T {
		if (this.store.has(key)) return this.store.get(key);
		return this.set(key, fn());
	}

	/**
	 * check if the value is in the cache else calls the fn
	 *
	 * See also {@link getOrInsertComputed}
	 *
	 * @deprecated use {@link getOrInsertLoaded} instead
	 */
	async load<T>(key: string, fn: () => Promise<T>): Promise<T> {
		return this.getOrInsertLoaded<T>(key, fn);
	}

	/**
	 * check if the value is in the cache else calls the fn
	 *
	 * See also {@link getOrInsertComputed}
	 */
	async getOrInsertLoaded<T>(key: string, fn: () => Promise<T>): Promise<T> {
		if (this.store.has(key)) return this.store.get(key);
		return this.set(key, await fn());
	}

	/**
	 * One-shot SSR handoff value.
	 *
	 * Intended use: call this once per request (per key) during SSR to generate
	 * a value that must match between server render and client hydration.
	 *
	 * On the server, the value is generated once per key and stored for hydration.
	 * Subsequent calls with the same key during SSR currently return the same value,
	 * but this behaviour is an implementation detail and may change in the future.
	 * Consumers should rely on calling this at most once per key during SSR.
	 *
	 * On the client, the stored value is returned exactly once and removed.
	 * Subsequent calls return a fresh value and are not cached.
	 *
	 * Warning: this function is designed to be called once per key during SSR.
	 * Calling it multiple times may lead to unexpected behaviour if the server-side
	 * implementation changes.
	 *
	 * See also {@link getOrInsertComputed}
	 */
	takeOnce<T>(key: string, fn: () => T): T {
		if (import.meta.env.SSR) {
			if (this.store.has(key)) {
				console.warn(
					`SsrCache.takeOnce called multiple times for key "${key}" during SSR.`,
				);
				return this.store.get(key);
			}
			return this.set(key, fn());
		}
		if (this.store.has(key)) return this.remove<T>(key)!;
		return fn();
	}

	/**
	 * Remove a value from the cache and return it
	 */
	remove<T>(key: string): T | null {
		const val = this.get<T>(key);
		this.store.delete(key);
		return val;
	}

	/** @hidden */
	z_clear() {
		this.store.clear();
	}

	/** @hidden */
	z_importFromHead() {
		// @ts-ignore
		this.store = new Map(window._SSR_STORE ?? []);
		// @ts-ignore
		delete window._SSR_STORE;
	}

	private exportAsJson(): string {
		return JSON.stringify(Array.from(this.store.entries())).replace(
			/</g,
			'\\u003c',
		);
	}

	/** @hidden */
	z_exportToHead(): string {
		return `\n\t\t<script>window._SSR_STORE = ${this.exportAsJson()};</script>`;
	}
}
