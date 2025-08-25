import { clone, CloneableOrPrimitive } from '../index.js';
import Readable from './Readable.js';
import { Readable as SvelteReadable } from 'svelte/store';

/**
 * A svelte store
 */
export default class Readclone<
	T extends CloneableOrPrimitive,
> extends Readable<T> {
	/**
	 * Creates a new Readclone
	 */
	constructor(inner: SvelteReadable<T>) {
		super(inner);
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void, invalidate?: () => void): () => void {
		return super.subscribe(t => fn(clone(t)), invalidate);
	}

	/**
	 * Get the current value
	 */
	get(): T {
		return clone(super.get());
	}
}
