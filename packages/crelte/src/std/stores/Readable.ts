import { get as getStore, Readable as SvelteReadable } from 'svelte/store';

/**
 * A svelte store
 */
export default class Readable<T> {
	private inner: SvelteReadable<T>;
	private getFn: () => T;

	/**
	 * Creates a new Readable
	 */
	constructor(inner: SvelteReadable<T>) {
		const nInner = inner as SvelteReadable<T> & { get?: () => T };
		this.inner = inner;
		this.getFn =
			typeof nInner.get === 'function'
				? () => nInner.get!()
				: () => getStore(nInner);
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void, invalidate?: () => void): () => void {
		return this.inner.subscribe(fn, invalidate);
	}

	/**
	 * Get the current value
	 */
	get(): T {
		return this.getFn();
	}
}
