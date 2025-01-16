import Site from './Site.js';
import { trimSlashEnd } from './utils.js';

export type RouteOptions = {
	scrollY?: number;
	index?: number;
	origin?: RouteOrigin;
};

/**
 * RouteOrigin represents the origin of a route.
 * This type is non-exhaustive and might expand in the future.
 *
 * - `'init'`: is set on the first page load
 * - `'manual'`: is set when a route is triggered manually via `Router.open`
 * - `'live-preview-init'`: is set on the first page load in live preview mode
 * - `'click'`: is set when a route is triggered by a click event
 * - `'pop'`: is set when a route is triggered by a popstate event (back/forward)
 */
export type RouteOrigin =
	| 'init'
	| 'live-preview-init'
	| 'manual'
	| 'click'
	| 'pop';

/**
 * A Route contains information about the current page for example the url and
 * the site id
 *
 * ## Note
 * Never update the route directly, clone it before
 */
export default class Route {
	/**
	 * The url of the route
	 */
	url: URL;

	/**
	 * The site of the route if it could be defined
	 */
	site: Site | null;

	/**
	 * The scroll position of the current route
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
	 * Creates a new Route
	 */
	constructor(url: string | URL, site: Site | null, opts: RouteOptions = {}) {
		this.url = new URL(url);

		this.site = site;
		this.scrollY = opts.scrollY ?? null;
		this.index = opts.index ?? 0;
		this.origin = opts.origin ?? 'manual';
	}

	/**
	 * Returns the uri of the route
	 *
	 * Never ends with a slash
	 *
	 * ## Example
	 * ```
	 * const route = new Route('https://example.com/foo/bar/', null);
	 * console.log(route.uri); // '/foo/bar'
	 *
	 * const site = _; // site with url https://example.com/foo
	 * const route2 = new Route('https://example.com/foo/bar/?a=1', site);
	 * console.log(route2.uri); // '/bar'
	 * ```
	 */
	get uri(): string {
		// todo check if this is correct
		if (this.site) {
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
	 * const route = new Route('https://example.com/foo/bar/', null);
	 * console.log(route.baseUrl); // 'https://example.com'
	 *
	 * const site = _; // site with url https://example.com/foo
	 * const route2 = new Route('https://example.com/foo/bar/', site);
	 * console.log(route2.baseUrl); // 'https://example.com/foo'
	 * ```
	 */
	get baseUrl(): string {
		if (this.site) return trimSlashEnd(this.site.url.href);

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
	 * Checks if the route is equal to another route
	 *
	 * This checks all properties of the url but search params do not have to be
	 * in the same order
	 */
	eq(route: Route) {
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

		return (
			route &&
			this.url.pathname === route.url.pathname &&
			this.url.origin === route.url.origin &&
			searchEq(this.search, route.search) &&
			this.hash === route.hash
		);
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
	 * Sets the search param or removes it if the value is null or undefined
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
		if (typeof value !== 'undefined' && value !== null) {
			this.search.set(key, value as string);
		} else {
			this.search.delete(key);
		}
	}

	/**
	 * Create a copy of the request
	 */
	clone() {
		return new Route(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
		});
	}

	/** @hidden */
	_fillFromState(state: any) {
		if (typeof state?.route?.scrollY === 'number')
			this.scrollY = state.route.scrollY;

		if (typeof state?.route?.index === 'number')
			this.index = state.route.index;
	}

	/** @hidden */
	_toState(): any {
		return {
			route: {
				scrollY: this.scrollY,
				index: this.index,
			},
		};
	}
}
