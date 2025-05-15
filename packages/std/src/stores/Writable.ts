import { CloneableOrPrimitive } from '../index.js';
import { Writable as SvelteWritable, writable } from 'svelte/store';
import Readable from './Readable.js';
import Readclone from './Readclone.js';

/**
 * A svelte store
 *
 * Prefer `import { writable } from 'svelte/store';` if you don't have
 * specific needs
 */
export default class Writable<T> {
	private inner: T;
	private store: SvelteWritable<object>;

	/**
	 * Creates a new Writable
	 *
	 * @param def A default value
	 */
	constructor(def: T) {
		this.inner = def;
		this.store = writable({});
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * ## Note
	 * This does not check for equality like svelte.
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void, invalidate?: () => void): () => void {
		return this.store.subscribe(() => fn(this.inner), invalidate);
	}

	/**
	 * Sets the value and calls all subscribers with the value
	 */
	set(inner: T) {
		this.inner = inner;
		this.store.set({});
	}

	/**
	 * Sets the value without calling all subscribers
	 */
	setSilent(inner: T) {
		this.inner = inner;
	}

	/**
	 * calls all subscribers with the value
	 */
	notify() {
		this.store.set({});
	}

	/**
	 * Get the current value
	 */
	get(): T {
		return this.inner;
	}

	readonly(): Readable<T> {
		return new Readable(this);
	}

	readclone<U extends T & CloneableOrPrimitive>(
		this: Writable<U>,
	): Readclone<U> {
		return new Readclone(this);
	}
}
