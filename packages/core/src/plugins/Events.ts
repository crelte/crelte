import { CrelteRouted } from '../index.js';

export default class Events {
	inner: Map<string, Set<any>>;

	constructor() {
		this.inner = new Map();
	}

	/*
	 * Listens for an event.
	 */
	// override this function to add your own function signatures
	on(
		ev: 'loadGlobalData',
		fn: (cr: CrelteRouted) => Promise<any>,
	): () => void;
	on(
		ev: 'loadData',
		fn: (cr: CrelteRouted, entry: any, data: any) => Promise<any>,
	): () => void;
	on(ev: 'beforeRender', fn: (cr: CrelteRouted) => void): () => void;
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

	remove(ev: string, fn: any) {
		const set = this.inner.get(ev);
		if (!set) return;

		set.delete(fn);
	}

	trigger(ev: string, ...args: any[]): any[] {
		const set = this.inner.get(ev);
		if (!set) return [];

		return Array.from(set).map(fn => fn(...args));
	}
}
