/*
// returns a store which get's updated as soon as the site changes
const emergency = getGlobal('emergency');

// returns the data based on the current site (no store)
cr.getGlobal('emergency')

*/

import { Writable } from 'crelte-std/stores';

export type GlobalWaiters<T> = [(g: T | null) => void];

/**
 * Globals is sort of a queue
 *
 * each time a new request get's started
 * a copy of globals is created which references some properties of the original one
 *
 * then if everything is loaded th original globals is "overriden" with the new one
 * and we get a new state
 */
export default class Globals {
	// while the globals are not loaded if somebody calls
	// getAsync then we need to store the waiters
	private waiters: Map<number, Map<string, GlobalWaiters<any>>>;
	private data: Map<number, Map<string, any>>;
	private stores: Map<string, Global<any>>;
	private currentSiteId: number | null;

	constructor() {
		this.waiters = new Map();
		this.data = new Map();
		this.stores = new Map();
		this.currentSiteId = null;
	}

	get<T = any>(name: string, siteId: number): T | null {
		return this.data.get(siteId)?.get(name) ?? null;
	}

	/**
	 * returns a store which contains a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `.getAsync`
	 */
	getStore<T = any>(name: string): Global<T> | null {
		return this.stores.get(name) ?? null;
	}

	/**
	 * Get a store which contains a globalSet and wait until it is loaded
	 *
	 * ## Note
	 * This is only useful in loadGlobalData in all other cases
	 * you can use `.getGlobal` which does return a Promise
	 */
	getAsync<T = any>(name: string, siteId: number): Promise<T | null> {
		if (this._wasLoaded(siteId))
			return Promise.resolve(this.get(name, siteId));

		let listeners = this.waiters.get(siteId);
		if (!listeners) {
			listeners = new Map();
			this.waiters.set(siteId, listeners);
		}

		let waiter = listeners.get(name);
		if (!waiter) {
			waiter = [] as any;
			listeners.set(name, waiter!);
		}

		return new Promise(resolve => {
			waiter!.push(resolve);
		});
	}

	/** @hidden */
	_wasLoaded(siteId: number): boolean {
		return this.data.has(siteId);
	}

	// data is the data from the global graphql
	// so it contains some keys and data which should be parsed
	// and created a store for each key
	// do not call this if _wasLoaded returns true with the same siteId
	/** @hidden */
	_setData(siteId: number, data: any) {
		const map = new Map(Object.entries(data));
		this.data.set(siteId, map);

		this.waiters.get(siteId)?.forEach((waiters, key) => {
			waiters.forEach(waiter => waiter(map.get(key)));
		});
		this.waiters.delete(siteId);
	}

	/** @hidden */
	_updateSiteId(siteId: number) {
		if (this.currentSiteId === siteId) return;

		const data = this.data.get(siteId) ?? new Map();

		// we set all global data to null via setSilent
		// then set them all with the new data
		// and update all of them

		this.stores.forEach(global => global._setSilent(null));

		data.forEach((value, key) => {
			let global = this.stores.get(key);
			if (global) {
				global._setSilent(value);
			} else {
				global = new Global(key, value);
				this.stores.set(key, global);
			}
		});

		this.stores.forEach(global => global._notify());
	}
}

/**
 * A globalSet store
 */
export class Global<T = any> {
	/** @hidden */
	private inner: Writable<T>;

	constructor(name: string, data: T) {
		// todo remove in v1.0
		// In v0.2, we queried the global data for all sites.
		// We now check if the siteId is present and notify the user to remove it.
		if (
			typeof (data as any)?.siteId === 'number' ||
			(Array.isArray(data) && typeof data[0]?.siteId === 'number')
		) {
			throw new Error(
				`The global query ${name} should not include the siteId` +
					` property. Instead, use the siteId as a parameter.`,
			);
		}

		this.inner = new Writable(data);
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

	/**
	 * The current value
	 */
	get(): T {
		return this.inner.get();
	}

	/** @hidden */
	_setSilent(value: T) {
		this.inner.setSilent(value);
	}

	/** @hidden */
	_notify() {
		this.inner.notify();
	}
}
