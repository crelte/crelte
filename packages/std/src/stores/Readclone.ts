import { clone, CloneableOrPrimitive } from '../index.js';
import Readable from './Readable.js';
import type Writable from './Writable.js';

/**
 * A svelte store
 */
export default class Readclone<
	T extends CloneableOrPrimitive,
> extends Readable<T> {
	/**
	 * Creates a new Writable
	 *
	 * @param def A default value
	 */
	constructor(inner: Writable<T>) {
		super(inner);
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void): () => void {
		return super.subscribe(t => fn(clone(t)));
	}

	/**
	 * Get the current value
	 */
	get(): T {
		return clone(super.get());
	}
}
