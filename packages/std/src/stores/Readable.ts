import type Writable from './Writable.js';

/**
 * A svelte store
 */
export default class Readable<T> {
	private inner: Writable<T>;

	/**
	 * Creates a new Writable
	 *
	 * @param def A default value
	 */
	constructor(inner: Writable<T>) {
		this.inner = inner;
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void): () => void {
		return this.inner.subscribe(fn);
	}

	/**
	 * Get the current value
	 */
	get(): T {
		return this.inner.get();
	}
}
