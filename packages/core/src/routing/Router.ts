import { Readable } from 'svelte/store';
import BaseRouter from './BaseRouter.js';
import { Route, Site } from './index.js';

/**
 * Allows to easely modify a Request
 *
 * If you return `false` the request will be aborted
 *
 * ## Example
 * ```
 * router.replace(req => (req.hash = ''));
 * ```
 */
export type UpdateRequest = (req: Request) => boolean | null | undefined | void;

export default class Router {
	private inner: BaseRouter;

	constructor(inner: BaseRouter) {
		this.inner = inner;
	}

	/**
	 * returns a store with the current route
	 *
	 * ## Note
	 * Will always contain a route except in the first loadData call this
	 * is intentional since you will get the wrong route in a loadData call.
	 * In a loadData you should always use the `CrelteRequest` provided
	 * in each loadData call.
	 */
	get route(): Readable<Route | null> {
		return this.inner.route.readclone();
	}

	/**
	 * returns a store with the current site
	 *
	 * ## Note
	 * Will always contain a site except in the first loadData call this
	 * is intentional since you might get the wrong site if a site switch
	 * is happening and you call this in loadData. If possible use the CrelteRequest
	 * provided in each loadData call.
	 *
	 * Else use `router.site.get() ?? router.req.site`
	 */
	get site(): Readable<Site | null> {
		return this.inner.site.readonly();
	}

	/**
	 * returns the latest request in progress otherwise returns null.
	 *
	 * ## Important !!
	 * If at all possible prefer using the `CrelteRequest` provided in each
	 * loadData call. For example in a preload request this will return null.
	 * Or a user has clicked multiple times on different links you might get
	 * the url of the newer request.
	 */
	get req(): Request | null {
		return this.inner.request;
	}
}
