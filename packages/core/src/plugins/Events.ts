import { EntryQueryVars } from '../entry/index.js';
import { CrelteRequest, Entry } from '../index.js';
import { Route } from '../routing/index.js';

export default class Events {
	inner: Map<string, Set<any>>;

	constructor() {
		this.inner = new Map();
	}

	/**
	 * Listens for an event.
	 *
	 * ## beforeRequest
	 * Please prefer to return not return a promise only if you need to wait
	 * for something. This allows a push request to be done without a microtask.
	 * Allowing for a better DX.
	 *
	 * @returns a function to remove the listener
	 */
	// override this function to add your own function signatures
	on(
		ev: 'beforeRequest',
		fn: (cr: CrelteRequest) => Promise<void> | void,
	): () => void;
	on(
		ev: 'loadGlobalData',
		fn: (cr: CrelteRequest) => Promise<any>,
	): () => void;
	on(
		ev: 'afterLoadEntry',
		fn: (cr: CrelteRequest) => Promise<any>,
	): () => void;
	on(
		ev: 'loadData',
		fn: (cr: CrelteRequest, entry: Entry) => Promise<any>,
	): () => void;
	on(ev: 'beforeRender', fn: (cr: CrelteRequest) => void): () => void;
	// todo maybe add this
	// on(
	// 	ev: 'loadEntry',
	// 	fn: (
	// 		cr: CrelteRequest,
	// 		vars: EntryQueryVars | null,
	// 		/** this might contain other plugin calls */
	// 		runQuery: (vars: EntryQueryVars | null) => Promise<Entry | null>,
	// 	) => Promise<Entry | null>,
	// ): () => void;
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
	 * Check if an event has listeners
	 */
	has(ev: string): boolean {
		const size = this.inner.get(ev)?.size ?? 0;
		return size > 0;
	}

	/**
	 * Trigger an event
	 */
	trigger(ev: 'beforeRequest', cr: CrelteRequest): (Promise<void> | void)[];
	trigger(ev: 'loadGlobalData', cr: CrelteRequest): Promise<any>[];
	trigger(ev: 'afterLoadEntry', cr: CrelteRequest): Promise<any>[];
	trigger(ev: 'loadData', cr: CrelteRequest, entry: Entry): Promise<any>[];
	trigger(ev: 'beforeRender', cr: CrelteRequest, route: Route): void[];
	trigger(ev: string, ...args: any[]): any[] {
		const set = this.inner.get(ev);
		if (!set) return [];

		return Array.from(set).map(fn => fn(...args));
	}

	// /**
	//  * Get all listeners for an event
	//  */
	// // getListeners(
	// // 	ev: 'queryEntry',
	// // ): ((
	// // 	cr: CrelteRequest,
	// // 	vars: EntryQueryVars | null,
	// // 	runQuery: (vars: EntryQueryVars | null) => Promise<Entry | null>,
	// // ) => Promise<Entry | null>)[];
	// getListeners(ev: string): any[] {
	// 	return Array.from(this.inner.get(ev) ?? []);
	// }
}
