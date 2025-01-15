import { CrelteRequest } from '../index.js';

export default class Events {
	inner: Map<string, Set<any>>;

	constructor() {
		this.inner = new Map();
	}

	/**
	 * Listens for an event.
	 *
	 * @returns a function to remove the listener
	 */
	// override this function to add your own function signatures
	on(
		ev: 'loadGlobalData',
		fn: (cr: CrelteRequest) => Promise<any>,
	): () => void;
	on(
		ev: 'loadData',
		fn: (cr: CrelteRequest, entry: any) => Promise<any>,
	): () => void;
	on(ev: 'beforeRender', fn: (cr: CrelteRequest) => void): () => void;
	on(ev: string, fn: (...args: any[]) => any): () => void {
		let set = this.inner.get(ev);
		if (!set) {
			set = new Set();
			this.inner.set(ev, set);
		}

		set.add(fn);

		return () => {
			set!.delete(fn);
		};
	}

	/**
	 * Remove a listener
	 */
	remove(ev: string, fn: any) {
		const set = this.inner.get(ev);
		if (!set) return;

		set.delete(fn);
	}

	/**
	 * Trigger an event
	 */
	trigger(ev: 'loadGlobalData', cr: CrelteRequest): Promise<any>[];
	trigger(ev: 'loadData', cr: CrelteRequest, entry: any): Promise<any>[];
	trigger(ev: 'beforeRender', cr: CrelteRequest): void[];
	trigger(ev: string, ...args: any[]): any[] {
		const set = this.inner.get(ev);
		if (!set) return [];

		return Array.from(set).map(fn => fn(...args));
	}
}
