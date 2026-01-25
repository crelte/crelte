import BaseRouter from './BaseRouter.js';
import { Request, RequestOptions, Route, Site } from '../index.js';
import { CrelteRequest } from '../../crelte.js';
import { Readable } from '../../std/stores/index.js';
import { Entry } from '../../loadData/index.js';

/**
 * Allows to easely modify a Request
 *
 * If you return `false` the request will be aborted
 *
 * #### Example
 * ```js
 * router.replace(req => (req.hash = ''));
 * ```
 */
export type UpdateRequest = (req: Request) => boolean | null | undefined | void;

/**
 * The Crelte Router
 */
export default class Router {
	private inner: BaseRouter;
	private _request: Request | null;

	constructor(inner: any) {
		this.inner = inner as BaseRouter;
		this._request = null;
	}

	/**
	 * returns a store with the current route
	 *
	 * #### Note
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
	 * #### Note
	 * Will always contain a site except in the first loadData call this
	 * is intentional since you might get the wrong site if a site switch
	 * is happening and you call this in loadData. If possible use the {@link CrelteRequest#site}
	 * provided in each loadData call.
	 *
	 * Else use `router.site.get() ?? router.req.site`
	 */
	get site(): Readable<Site | null> {
		return this.inner.site.readonly();
	}

	/**
	 * returns a store with the current entry
	 *
	 * #### Note
	 * Will always contain an entry except in the first loadData call this
	 * is intentional since you might get the wrong entry if a request is happening
	 * and you call this in loadData. If possible use the CrelteRequest
	 * provided in each loadData call.
	 */
	get entry(): Readable<Entry | null> {
		return this.inner.entry.readonly();
	}

	/**
	 * returns the latest request in progress otherwise returns null.
	 *
	 * #### Important !!
	 * If at all possible prefer using the {@link CrelteRequest} provided in each
	 * loadData call. For example in a preload request this will return null.
	 * Or a user has clicked multiple times on different links you might get
	 * the url of the newer request.
	 */
	get req(): Request | null {
		// this._request is not used because that could be a weird
		// behaviour for the user
		// we will use that however internally
		// todo maybe reconsider this?
		return this.inner.request;
	}

	/**
	 * The sites which are available
	 */
	get sites(): Site[] {
		return this.inner.sites;
	}

	/**
	 * The languages which the user prefers
	 *
	 * This comes from Accept-Language header or the navigator.languages
	 */
	get preferredLanguages(): string[] {
		return this.inner.languages;
	}

	/**
	 * returns a store which indicates if the a page is loading
	 */
	get loading(): Readable<boolean> {
		return this.inner.loading.readonly();
	}

	/**
	 * returns a store which indicates the loading progress between 0 and 1
	 */
	get loadingProgress(): Readable<number> {
		return this.inner.loadingProgress.readonly();
	}

	/**
	 * Returns the primary site
	 */
	primarySite(): Site {
		return this.inner.primarySite();
	}

	/**
	 * Returns a site which is preferred based on the users language
	 *
	 * Returns null if no site could be determined
	 */
	preferredSite(): Site | null {
		return this.inner.preferredSite();
	}

	/**
	 * Open a new route
	 *
	 * @param target the target to open can be an url, a route or a request
	 * the url needs to start with http or with a / which will be considered as
	 * the site baseUrl
	 *
	 * #### Note
	 * The origin will always be set to 'manual'
	 *
	 * #### Example
	 * ```js
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 * console.log(router.site.get().url.href); // 'https://example.com/de';
	 *
	 * router.open('/foo/bar');
	 * // the following page will be opened https://example.com/de/foo/bar
	 * ```
	 */
	async open(
		target: string | URL | Route | Request | UpdateRequest,
		opts: RequestOptions = {},
	): Promise<Route | void> {
		const req = this.targetOrUpdateToRequest(target, {
			...opts,
			origin: 'manual',
		});
		if (!req) return;

		if (req === this.inner.request) {
			throw new Error(
				'Cannot open the same request object twice. Either clone the request ' +
					'or just pass in the url.',
			);
		}

		try {
			return await this.inner.openRequest(req);
		} catch (e) {
			console.warn('opening route failed', e);
			throw e;
		}
	}

	/**
	 * This pushes the new route without triggering a new pageload
	 *
	 * You can use this when using pagination for example change the route object
	 * (search argument) and then call push
	 *
	 * #### Note
	 * This will always set the origin to 'push'
	 * And will clear the scrollY value if you dont provide a new one via the `opts`
	 * This will disableLoadData by default if you dont provide an override via the `opts`
	 *
	 * #### Example using the update function
	 * ```js
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 *
	 * const page = 1;
	 * router.push(req => req.setSearchParam('page', page || null));
	 * ```
	 *
	 * #### Example using the route object
	 * ```js
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 *
	 * const page = 1;
	 * const route = router.route.get();
	 * route.setSearchParam('page', page > 0 ? page : null);
	 * router.push(route);
	 * ```
	 */
	async push(
		route: Route | Request | UpdateRequest,
		opts: RequestOptions = {},
	) {
		// theoretically string and URL also work but we might
		// change that in the future
		const req = this.targetOrUpdateToRequest(route, {
			...opts,
			origin: 'push',
			// this will always override the scrollY
			scrollY: opts.scrollY ?? null,
			disableLoadData: opts.disableLoadData ?? true,
		});
		if (!req) return;

		try {
			return await this.inner.pushRequest(req, opts);
		} catch (e) {
			console.warn('pushing route failed', e);
			throw e;
		}
	}

	/**
	 * @deprecated use push instead
	 */
	pushState(route: Route | Request) {
		console.warn('pushState is deprecated, use push instead');
		this.push(route);
	}

	/**
	 * This replaces the state of the route without triggering a new pageload
	 *
	 * You can use this when using some filters for example a search filter
	 *
	 * #### Note
	 * This will always set the origin to 'replace'
	 * And will clear the scrollY value if you don't provide a new one via the `opts`
	 * This will disableLoadData by default if you don't provide an override via the `opts`
	 *
	 * #### Example using the update function
	 * ```js
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 *
	 * const search = 'foo';
	 * router.replace(req => req.setSearchParam('search', search));
	 * ```
	 *
	 * #### Example using the route object
	 * ```js
	 * import { getRouter } from 'crelte';
	 *
	 * const router = getRouter();
	 *
	 * const search = 'foo';
	 * const route = router.route.get();
	 * route.setSearchParam('search', search);
	 * router.replace(route);
	 * ```
	 */
	async replace(
		route: Route | Request | UpdateRequest,
		opts: RequestOptions = {},
	) {
		const req = this.targetOrUpdateToRequest(route, {
			...opts,
			origin: 'replace',
			// this will always override the scrollY
			scrollY: opts.scrollY ?? null,
			disableLoadData: opts.disableLoadData ?? true,
		});
		if (!req) return;

		try {
			return await this.inner.replaceRequest(req, opts);
		} catch (e) {
			console.warn('replacing route failed', e);
			throw e;
		}
	}

	/**
	 * @deprecated use replace instead
	 */
	replaceState(route: Route | Request) {
		console.warn('replaceState is deprecated, use replace instead');
		this.replace(route);
	}

	/**
	 * Checks if there are previous routes which would allow it to go back
	 *
	 * On the server this will always return false
	 */
	canGoBack(): boolean {
		// todo should this be dependent on the current request?
		return this.inner.canGoBack();
	}

	/**
	 * Go back in the history
	 *
	 * On the server this throw an error
	 */
	back() {
		// todo should this be dependent on the current request?
		this.inner.back();
	}

	/**
	 * Preload a url
	 */
	preload(target: string | URL | Route) {
		this.inner.preload(target);
	}

	/**
	 * Add a listener for the onRoute event
	 *
	 * This will trigger every time a new route is set
	 * and is equivalent to router.route.subscribe(fn)
	 * except that it will not trigger instantly
	 *
	 * @returns a function to remove the listener
	 */
	onRoute(fn: (route: Route) => void): () => void {
		return this.inner.onRouteListeners.add(fn);
	}

	/**
	 * Add a listener for the onRequest event
	 *
	 * This will trigger every time a new route is requested
	 *
	 * @returns a function to remove the listener
	 */
	onRequest(fn: (req: CrelteRequest) => void): () => void {
		return this.inner.onRequestListeners.add(fn);
	}

	/**
	 * Resolve a url or Route and convert it to a Request
	 *
	 * @param target
	 * @param opts any option present will override the value in target
	 * @return Returns null if the url does not match our host (the protocol get's ignored)
	 */
	targetToRequest(
		target: string | URL | Route | Request,
		opts: RequestOptions = {},
	): Request {
		return this.inner.targetToRequest(target, opts);
	}

	/**
	 * Transforms a target to a request
	 *
	 * returns null if the request was canceled by the update request
	 */
	private targetOrUpdateToRequest(
		target: string | URL | Route | Request | UpdateRequest,
		opts: RequestOptions = {},
	): Request | null {
		// we have an update request
		if (typeof target === 'function') {
			const source = this._request?.clone() ?? this.route.get();
			if (!source) {
				// todo should we use the request here?
				throw new Error(
					'route to update missing in first loadData call. ' +
						'Use `cr.router...` or `cr.req.clone()`',
				);
			}

			// first get a req
			const req = this.inner.targetToRequest(source, opts);
			// check if the request was canceled by the update request
			if (target(req) === false) return null;

			return req;
		}

		return this.inner.targetToRequest(target, opts);
	}

	/**
	 * @hidden
	 * call this after creating a CrelteRequest
	 */
	z_toRequest(req: Request) {
		const nRouter = new Router(this.inner);
		nRouter._request = req;
		return nRouter;
	}

	_requestCompleted() {
		this._request = null;
	}
}
