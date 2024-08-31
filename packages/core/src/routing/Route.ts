import { trimSlashEnd } from './Router.js';
import Site from './Site.js';

export type RouteOpts = {
	scrollY?: number;
	index?: number;
	origin?: RouteOrigin;
};

export type RouteOrigin = 'init' | 'live-preview-init' | 'click' | 'pop';

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
	scrollY: number;

	/**
	 * the position in the browser history of this route
	 * this allows to find out if we can go back
	 */
	index: number | null;

	/**
	 * The origin of this route
	 *
	 * Might pop, click or init (non exclusive)
	 */
	origin: RouteOrigin | null;

	/**
	 * Creates a new Route
	 */
	constructor(url: string | URL, site: Site | null, opts: RouteOpts = {}) {
		this.url = new URL(url);

		this.site = site;
		this.scrollY = opts.scrollY ?? 0;
		this.index = opts.index ?? null;
		this.origin = opts.origin ?? null;
	}

	/**
	 * Returns the uri of the route
	 *
	 * Never ends with a slash
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

	// todo is this correct and do we wan't it?
	/**
	 * Never ends with a slash
	 */
	get baseUrl(): string {
		if (this.site) return trimSlashEnd(this.site.url.href);

		return this.url.origin;
	}

	get search(): URLSearchParams {
		return this.url.searchParams;
	}

	get hash(): string {
		return this.url.hash;
	}

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
	 */
	getSearchParam(key: string): string | null {
		return this.search.get(key);
	}

	/**
	 * Sets the search param or removes it if the value is falsy
	 */
	setSearchParam(key: string, value?: string | null) {
		if (value) this.search.set(key, value);
		else this.search.delete(key);
	}

	clone() {
		return new Route(this.url.href, this.site, {
			scrollY: this.scrollY,
			index: this.index ?? undefined,
			origin: this.origin ?? undefined,
		});
	}

	// internal function
	_fillFromState(state: any) {
		if (typeof state?.route?.scrollY === 'number')
			this.scrollY = state.route.scrollY;

		if (typeof state?.route?.index === 'number')
			this.index = state.route.index;
	}

	// internal function
	_toState(): any {
		return {
			route: {
				scrollY: this.scrollY,
				index: this.index,
			},
		};
	}
}
