/*
// returns a store which get's updated as soon as the site changes
const emergency = getGlobal('emergency');

// returns the data based on the current site (no store)
cr.getGlobal('emergency')
*/

import { Writable } from '../stores/index.js';

export type GlobalWaiters = [(g: Global<any> | null) => void];

export default class Globals {
	// while the globals are not loaded if somebody calls
	// getOrWait then we need to store the waiters
	private waiters: Map<string, GlobalWaiters>;
	private entries: Map<string, Global<any>>;
	private loaded: boolean;
	private prevSiteId: number | null;

	constructor() {
		this.waiters = new Map();
		this.entries = new Map();
		this.loaded = false;
		this.prevSiteId = null;
	}

	get(name: string): Global<any> | null {
		return this.entries.get(name) ?? null;
	}

	// call this only in loadGlobalData when by default the global
	// is not available
	getAsync(name: string): Promise<Global<any> | null> | Global<any> | null {
		if (this.loaded) return this.get(name);

		let waiter = this.waiters.get(name);
		if (!waiter) {
			waiter = [] as any;
			this.waiters.set(name, waiter!);
		}

		return new Promise(resolve => {
			waiter!.push(resolve);
		});
	}

	// hidden
	_wasLoaded(): boolean {
		return this.loaded;
	}

	// hidden
	// data is the data from the global graphql
	// so it contains some keys and data which should be parsed
	// and created a store for each key
	_setData(siteId: number, data: any) {
		const wasLoaded = this.loaded;
		this.loaded = true;

		for (const [key, value] of Object.entries(data)) {
			this.entries.set(key, new Global(key, value as any, siteId));
		}

		if (!wasLoaded) {
			this.waiters.forEach((waiters, key) => {
				waiters.forEach(waiter => waiter(this.get(key)));
			});
			this.waiters.clear();
		}
	}

	_globalsBySite(siteId: number): Map<string, any> {
		const map = new Map();

		for (const [key, global] of this.entries) {
			map.set(key, global.bySiteId(siteId));
		}

		return map;
	}

	_updateSiteId(siteId: number) {
		// todo we should only trigger
		if (this.prevSiteId === siteId) return;

		this.entries.forEach(global => global._updateSiteId(siteId));
	}
}

export interface GlobalData {
	siteId?: number;
}

export class Global<T extends GlobalData> {
	private inner: Writable<T>;
	/// if languages is null this means we always have the same data
	private languages: T[] | null;

	constructor(name: string, data: T[] | T, siteId: number) {
		this.languages = null;

		let inner: T;
		if (Array.isArray(data)) {
			// make sure the data contains an object with the property
			// siteId
			this.languages = data;
			inner = data.find(d => d.siteId === siteId)!;

			if (!inner?.siteId) {
				throw new Error(
					`The global query ${name} does not contain the required siteId property`,
				);
			}
		} else {
			inner = data;
		}

		this.inner = new Writable(inner);
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

	get(): T {
		return this.inner.get();
	}

	/// if you pass a siteId which comes from craft then you will never receive null
	bySiteId(siteId: number): T | null {
		if (this.languages)
			return this.languages.find(d => d.siteId === siteId) ?? null;

		return this.inner.get();
	}

	_updateSiteId(siteId: number) {
		if (!this.languages) return;

		const inner = this.languages.find(d => d.siteId === siteId);
		this.inner.set(inner!);
	}
}
