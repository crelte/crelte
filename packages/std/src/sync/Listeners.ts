/**
 * Manages event listeners or functions.
 */
export default class Listeners<T extends any[]> {
	private inner: Set<(...args: T) => void>;

	/**
	 * Creates a new instance of Listeners.
	 */
	constructor() {
		this.inner = new Set();
	}

	/**
	 * Adds a new listener to the set.
	 *
	 * @param fn The function to be added as a listener. It should accept the same arguments as those passed to trigger.
	 * @returns A function that, when called, will remove the added listener from the set.
	 */
	add(fn: (...args: T) => void): () => void {
		const set = this.inner;
		set.add(fn);
		return () => {
			set.delete(fn);
		};
	}

	/**
	 * Calls each listener in the set with the given arguments.
	 *
	 * @param args The arguments to be passed to each listener.
	 * @throws Will throw an error if a listener throws an error.
	 */
	trigger(...args: T) {
		this.inner.forEach(fn => fn(...args));
	}

	/**
	 * Clears all listeners from the set, then calls each previously stored listener with the given arguments.
	 *
	 * @param args The arguments to be passed to each listener.
	 * @throws Will throw an error if a listener throws an error.
	 */
	clearAndTrigger(...args: T) {
		const s = this.inner;
		this.clear();
		s.forEach(fn => fn(...args));
	}

	/**
	 * Removes all listeners from the set.
	 */
	clear() {
		this.inner = new Set();
	}
}
