/*
// returns a store which get's updated as soon as the site changes
const emergency = getGlobal('emergency');

// returns the data based on the current site (no store)
cr.getGlobal('emergency')

*/

import { Readable, Writable } from 'crelte-std/stores';

export type GlobalWaiters<T> = ((g: T | null) => void)[];

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
	// this get's created as soon as a request was started
	// and get's deleted as soon as all globals are loaded
	private waiters: Map<string, GlobalWaiters<any>> | null;

	// this get's created as soon as a request was started
	// and deleted once they are synced to the stores
	private newData: Map<string, any> | null;

	// contains the current active globals
	private stores: Map<string, Writable<any>>;

	constructor(stores?: Map<string, Writable<any>>) {
		this.waiters = null;
		this.newData = null;
		this.stores = stores ?? new Map();
	}

	/**
	 * returns a globalValue
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * throw an error. In that context you should use `.getAsync`
	 */
	get<T = any>(name: string): T | null {
		if (this.waiters)
			throw new Error(
				'calling get in loadGlobalData will not work. call getAsync',
			);

		if (this.newData) return this.newData.get(name) ?? null;

		return this.getStore(name)?.get() ?? null;
	}

	/**
	 * returns a store which contains a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `.getAsync`
	 */
	getStore<T = any>(name: string): Readable<T> | null {
		return this.stores.get(name)?.readonly() ?? null;
	}

	/**
	 * Get a store which contains a globalSet and wait until it is loaded
	 *
	 * ## Note
	 * This is only useful in loadGlobalData in all other cases
	 * you can use `.get` which does not return a Promise
	 */
	getAsync<T = any>(name: string): Promise<T | null> | T | null {
		if (this.newData) return this.newData.get(name) ?? null;

		if (!this.waiters) return this.stores.get(name)?.get() ?? null;

		let listeners = this.waiters.get(name);
		if (!listeners) {
			listeners = [];
			this.waiters.set(name, listeners);
		}

		return new Promise(resolve => listeners.push(resolve));
	}

	/**
	 * can only be called in loadGlobalData contexts
	 */
	set<T>(name: string, data: T) {
		if (!this.newData) {
			// this is not strictly necessary but
			throw new Error('can only be called in loadGlobalData contexts');
		}

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

		this.newData?.set(name, data);

		const listeners = this.waiters?.get(name);
		if (listeners) {
			this.waiters!.delete(name);
			listeners.forEach(fn => fn(data));
		}
	}

	/**
	 * @hidden
	 * call this before starting the loadGlobalData phase
	 */
	_toRequest() {
		const nGlobals = new Globals(this.stores);
		nGlobals.waiters = new Map();
		nGlobals.newData = new Map();

		return nGlobals;
	}

	/**
	 * @hidden
	 * call this after the loadGlobalData phase
	 */
	_globalsLoaded() {
		// todo should we check if there are still waiters?
		// theoretically this should never happen
		this.waiters = null;
	}

	/**
	 * @hidden
	 * call this after the loadData phase once the CrelteRequest
	 * gets completed
	 */
	_syncToStores() {
		const setToNull = new Set(this.stores.keys());

		for (const [name, data] of this.newData!.entries()) {
			setToNull.delete(name);

			const store = this.stores.get(name);
			if (store) {
				// todo should we do this check always?
				if (store.get() !== data) store.set(data);
			} else {
				this.stores.set(name, new Writable(data));
			}
		}

		for (const name of setToNull) {
			console.warn(
				`global ${name} was not modified setting to null and removing it`,
			);
			this.stores.get(name)!.set(null);
			this.stores.delete(name);
		}

		this.newData = null;
	}
}
