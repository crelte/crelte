import { CloneableOrPrimitive } from '../index.js';
import { Readable } from './index.js';
import Writable from './Writable.js';

export default class StagedWritable<T> {
	private inner: Writable<T>;
	// -1 = not staged, 0 = staged but no new value, 1 = staged
	private mode: -1 | 0 | 1;
	private staged: T | undefined;

	/**
	 * Creates a new StagedWritable
	 *
	 * @param def A default value
	 */
	constructor(def: T) {
		this.inner = new Writable(def);
		this.mode = -1;
		this.staged = undefined;
	}

	/**
	 * Returns true if the store is currently staged
	 */
	isStaged(): boolean {
		return this.mode >= 0;
	}

	/**
	 * Returns a new StagedWritable which is staged and has the same value as the current one
	 * To commit the staged value, call `commit` on the returned StagedWritable
	 */
	stage(): StagedWritable<T> {
		const n = Object.create(this);
		n.inner = this.inner;
		n.mode = 0;
		n.staged = undefined;
		return n;
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * #### Note
	 * This does not check for equality like svelte.
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void, invalidate?: () => void): () => void {
		return this.inner.subscribe(fn, invalidate);
	}

	/**
	 * Either updates the store and calls all subscribers with the value or
	 * updates the stateful value if previously toStateful was called
	 */
	set(inner: T) {
		if (this.mode >= 0) {
			this.mode = 1;
			this.staged = inner;
		} else {
			this.inner.set(inner);
		}
	}

	/**
	 * If the value was staged, then update the store and call all subscribers with the value
	 */
	commit() {
		if (this.mode < 0) throw new Error('not staged, call stage first');

		if (this.mode === 1) this.inner.set(this.staged as T);

		this.staged = undefined;
		this.mode = -1;
	}

	/**
	 * Get the current value either staged or not
	 */
	get(): T {
		if (this.mode === 1) return this.staged as T;
		return this.inner.get();
	}

	readonly(): Readable<T> {
		return this.inner.readonly();
	}

	readclone<U extends T & CloneableOrPrimitive>(
		this: StagedWritable<U>,
	): Readable<U> {
		return this.inner.readclone();
	}
}
