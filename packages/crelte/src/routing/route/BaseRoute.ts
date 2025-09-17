import { objClone } from '../../utils.js';
import Site from '../Site.js';
import { trimSlashEnd } from '../utils.js';

export type BaseRouteOptions = {
	scrollY?: number | null;
	index?: number;
	origin?: RouteOrigin;
	state?: Record<string, any>;
	context?: Record<string, any>;
};

/**
 * RouteOrigin represents the origin of a route.
 * This type is non-exhaustive and might expand in the future.
 *
 * - `'init'`: is set on the first page load
 * - `'manual'`: is set when a route is triggered manually via `Router.open`
 * - `'click'`: is set when a route is triggered by a click event
 * - `'pop'`: is set when a route is triggered by a popstate event (back/forward)
 * - `'replace'`: is set when a route is replaced via `Router.replaceState`
 * - `'push'`: is set when a route is pushed via `Router.pushState`
 *
 * ## Note
 * `replace` and `push` will not call loadData
 */
export type RouteOrigin =
	| 'init'
	| 'manual'
	| 'click'
	| 'pop'
	| 'replace'
	| 'push';

/**
 * A Route contains information about the current page for example the url and
 * the site
 */
export default class BaseRoute {
	/**
	 * The url of the route
	 */
	url: URL;

	/**
	 * The site of the route
	 *
	 * ## Note
	 * The site might not always match with the current route
	 * but be the site default site or one that matches the
	 * users language.
	 *
	 * If that is important call `route.siteMatches()` to verify
	 */
	site: Site;

	/**
	 * The scroll position of the current route
	 *
	 * ## Note
	 * This does not have to represent the current scroll position
	 * should more be used internally.
	 *
	 * It might be useful for a new request to specify the wanted
	 * scroll position
	 */
	scrollY: number | null;

	/**
	 * the position in the browser history of this route
	 * this allows to find out if we can go back
	 */
	index: number;

	/**
	 * The origin of this route, See [[RouteOrigin]]
	 */
	origin: RouteOrigin;

	/**
	 * @hidden
	 * State data that can be used to store additional information
	 */
	_state: Record<string, any>;

	/**
	 * @hidden
	 * Any data that should be passed to onRoute and onRequest handlers
	 * or exchanged between loadData's
	 * This context is not persistant and should be considered "valid"
	 * only for the current request / route
	 *
	 * ## Note
	 * Consider using state instead. This will not be cloned in the clone
	 * call so will always be the same object
	 */
	_context: Record<string, any>;

	/**
	 * Creates a new Route
	 */
	constructor(url: string | URL, site: Site, opts: BaseRouteOptions = {}) {
		this.url = new URL(url);

		this.site = site;
		this.scrollY = opts.scrollY ?? null;
		this.index = opts.index ?? 0;
		this.origin = opts.origin ?? 'manual';
		this._state = opts.state ?? {};
		this._context = opts.context ?? {};
	}

	/**
	 * Returns the uri of the route
	 *
	 * Never ends with a slash
	 *
	 * ## Example
	 * ```
	 * const site = _; // site with url https://example.com/fo
	 * const route = new Route('https://example.com/foo/bar/', site);
	 * console.log(route.uri); // '/bar'
	 *
	 * const site2 = _; // site with url https://example.com/other
	 * const route2 = new Route('https://example.com/foo/bar/?a=1', site2);
	 * console.log(route2.uri); // '/foo/bar'
	 * ```
	 */
	get uri(): string {
		if (this.siteMatches()) {
			return trimSlashEnd(
				this.url.pathname.substring(this.site.uri.length),
			);
		}

		return trimSlashEnd(this.url.pathname);
	}

	/**
	 * Returns the base url of the route
	 *
	 * Never ends with a slash
	 *
	 * ## Example
	 * ```
	 * const site = _; // site with url https://example.com/foo
	 * const route = new Route('https://example.com/foo/bar/', null);
	 * console.log(route.baseUrl); // 'https://example.com/foo'
	 *
	 * const site2 = _; // site with url https://example.com/other
	 * const route2 = new Route('https://example.com/foo/bar/', site2);
	 * console.log(route2.baseUrl); // 'https://example.com'
	 * ```
	 */
	get baseUrl(): string {
		if (this.siteMatches()) return trimSlashEnd(this.site.url.href);

		return this.url.origin;
	}

	/**
	 * Returns the search params
	 *
	 * ## Note
	 * You might also have a look at `getSearchParam` and `setSearchParam`
	 *
	 * ## Example
	 * ```
	 * const route = new Route('https://example.com/foo/bar/?a=1&b=2', null);
	 * console.log(route.search.get('a')); // '1'
	 * ```
	 */
	get search(): URLSearchParams {
		return this.url.searchParams;
	}

	/**
	 * Returns the hash of the route
	 *
	 * ## Example
	 * ```
	 * const route = new Route('https://example.com/foo/bar/#hash', null);
	 * console.log(route.hash); // '#hash'
	 * ```
	 */
	get hash(): string {
		return this.url.hash;
	}

	/**
	 * Set the hash of the route
	 *
	 * ## Example
	 * ```
	 * const route = new Route('https://example.com/foo/bar/', null);
	 * route.hash = '#hash';
	 * console.log(route.url.href); // 'https://example.com/foo/bar/#hash'
	 * ```
	 */
	set hash(hash: string) {
		this.url.hash = hash;
	}

	/**
	 * Checks if there are previous routes which would allow it to go back
	 */
	canGoBack(): boolean {
		return !!this.index;
	}

	/**
	 * Gets the search param
	 *
	 * ## Example
	 * ```
	 * const route = new Route('https://example.com/foo/bar/?a=1&b=2', null);
	 * console.log(route.getSearchParam('a')); // '1'
	 * ```
	 */
	getSearchParam(key: string): string | null {
		return this.search.get(key);
	}

	/**
	 * Sets the search param or removes it if the value is null, undefined or an
	 * empty string
	 *
	 * ## Example
	 * ```
	 * const route = new Route('https://example.com/foo/bar/?a=1&b=2', null);
	 * route.setSearchParam('a', '3');
	 * console.log(route.url.href); // 'https://example.com/foo/bar/?a=3&b=2'
	 *
	 * route.setSearchParam('a', null);
	 * console.log(route.url.href); // 'https://example.com/foo/bar/?b=2'
	 * ```
	 */
	setSearchParam(key: string, value?: string | number | null) {
		const deleteValue =
			typeof value === 'undefined' ||
			value === null ||
			(typeof value === 'string' && value === '');

		if (!deleteValue) {
			this.search.set(key, value as string);
		} else {
			this.search.delete(key);
		}
	}

	/**
	 * Returns a state value if it exists.
	 */
	getState<T = any>(key: string): T | null {
		return this._state[key] ?? null;
	}

	/**
	 * Sets a state value.
	 * If the value is null or undefined, the key will be removed.
	 *
	 * ## When to use state
	 * State is used to store additional information that persists across route changes.
	 * The State is only available in the client code since it is stored using window.history.
	 *
	 * Consider using setSearchParam instead to enable server side rendering.
	 */
	setState<T>(key: string, value: T | null | undefined) {
		if (typeof value === 'undefined' || value === null) {
			delete this._state[key];
		} else {
			this._state[key] = value;
		}
	}

	/**
	 * Returns a context value if it exists.
	 */
	getContext<T = any>(key: string): T | null {
		return this._context[key] ?? null;
	}

	/**
	 * Sets a context value.
	 * If the value is null or undefined, the key will be removed.
	 *
	 * ## When to use context
	 * Context is used to pass data to onRoute and onRequest handlers or exchange data between loadData calls.
	 * This context is not persistent and should be considered valid only for the current request/route.
	 * The context is not cloned in the clone call and will be the same object.
	 */
	setContext<T>(key: string, value: T | null | undefined) {
		if (typeof value === 'undefined' || value === null) {
			delete this._context[key];
		} else {
			this._context[key] = value;
		}
	}
	/**
	 * Returns true if the route is in live preview mode
	 */
	inLivePreview(): boolean {
		return !!this.search.get('x-craft-live-preview');
	}

	/**
	 * Returns if the site matches the url
	 */
	siteMatches(): boolean {
		if (this.url.origin !== this.site.url.origin) return false;

		// now we need to validate the pathname we should make sure both end with a slash
		// todo can we do this better?

		// make sure that urls like pathname: /abcbc and site: /abc don't match
		return (this.url.pathname + '/').startsWith(
			// uri never returns a slash at the end
			this.site.uri + '/',
		);
	}

	/**
	 * Checks if the route is equal to another route
	 *
	 * This checks the url but search params do not have to be in the
	 * same order
	 *
	 * ## Note
	 * This only check the url, not site or anything else.
	 */
	eq(route: BaseRoute | null) {
		return (
			route &&
			this.eqUrl(route) &&
			this.eqSearch(route) &&
			this.eqHash(route)
		);
	}

	/**
	 * Checks if the route is equal to another route
	 *
	 * This does not check the search params or hash
	 */
	eqUrl(route: BaseRoute | null) {
		return (
			route &&
			this.url.pathname === route.url.pathname &&
			this.url.origin === route.url.origin
		);
	}

	/**
	 * Checks if the search params are equal to another route
	 */
	eqSearch(route: BaseRoute | null) {
		const searchEq = (a: URLSearchParams, b: URLSearchParams) => {
			if (a.size !== b.size) return false;

			a.sort();
			b.sort();

			const aEntries = Array.from(a.entries());
			const bEntries = Array.from(b.entries());

			return aEntries
				.map((a, i) => [a, bEntries[i]])
				.every(([[ak, av], [bk, bv]]) => ak === bk && av === bv);
		};

		return route && searchEq(this.search, route.search);
	}

	/**
	 * Checks if the hash is equal to another route
	 */
	eqHash(route: BaseRoute | null) {
		return route && this.hash === route.hash;
	}

	/**
	 * Create a copy of the Route
	 *
	 * ## Note
	 * This does not make a copy of the template or context
	 */
	clone() {
		return new BaseRoute(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
			state: objClone(this._state),
			context: this._context,
		});
	}

	/** @hidden */
	_fillFromState(state: any) {
		// todo should this be here?
		// not better in the request?
		if (typeof state?.route?.scrollY === 'number')
			this.scrollY = state.route.scrollY;

		if (typeof state?.route?.index === 'number')
			this.index = state.route.index;

		if (typeof state?.state === 'object' && state.state !== null) {
			this._state = state.state;
		}
	}

	/** @hidden */
	_toState(): any {
		return {
			route: {
				scrollY: this.scrollY,
				index: this.index,
			},
			state: this._state,
		};
	}
}
