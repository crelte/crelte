import Listeners from 'chuchi-utils/sync/Listeners';
import Readable from './Readable.js';

/**
 * A svelte store
 */
export default class Writable<T> {
	private inner: T;
	private listeners: Listeners<[T]>;

	/**
	 * Creates a new Writable
	 *
	 * @param def A default value
	 */
	constructor(def: T) {
		this.inner = def;
		this.listeners = new Listeners();
	}

	/**
	 * The function get's called once with the current value and then when the
	 * values changes
	 *
	 * @return a function which should be called to unsubscribe
	 */
	subscribe(fn: (val: T) => void): () => void {
		fn(this.inner);

		return this.listeners.add(fn);
	}

	/**
	 * Sets the value and call alls subscribers with the value
	 */
	set(inner: T) {
		this.inner = inner;
		this.listeners.trigger(this.inner);
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
		this.listeners.trigger(this.inner!);
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
}
