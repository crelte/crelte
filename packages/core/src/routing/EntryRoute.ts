import Route, { RouteOrigin } from './Route.js';
import Site from './Site.js';
import { objClone } from '../utils.js';
import { Entry, LoadData } from '../index.js';

// Todo not sure this should be called EntryRoute
// since we already have entryRoutes and they both have nothing in common
// or should this be called Route
// and the previous Route should be PreRoute
// or BaseRoute?

export type EntryRouteOptions = {
	scrollY?: number;
	index?: number;
	origin?: RouteOrigin;
	state?: Record<string, any>;
	context?: Record<string, any>;
	entry: Entry;
	template: TemplateModule;
	loadedData: any;
};

export interface TemplateModule {
	// svelte component
	default: any;

	loadData?: LoadData<Entry>;
}

/**
 * A Request is a Route with some extra options
 * you get a Request from the onRequest event or
 * in a loadGlobal function.
 */
export default class EntryRoute extends Route {
	entry: Entry;

	template: TemplateModule;

	loadedData: any;

	/**
	 * Create a new EntryRoute
	 *
	 * ## Note
	 * This should only be created by crelte
	 */
	constructor(url: string | URL, site: Site, opts: EntryRouteOptions) {
		super(url, site, opts);

		this.entry = opts.entry;
		this.template = opts.template;
		this.loadedData = opts.loadedData;
	}

	/**
	 * Create an EntryRoute from a Route
	 */
	static fromRoute(route: Route, opts: EntryRouteOptions) {
		return new EntryRoute(route.url.href, route.site, {
			scrollY: route.scrollY ?? undefined,
			index: route.index,
			origin: route.origin,
			state: route._state,
			context: route._context,
			...opts,
		});
	}

	/**
	 * Create a copy of the EntryRoute

	* This does not make a copy of the template
	 */
	clone() {
		return new EntryRoute(this.url.href, this.site, {
			scrollY: this.scrollY ?? undefined,
			index: this.index,
			origin: this.origin,
			state: objClone(this._state),
			context: this._context,
			entry: objClone(this.entry),
			template: this.template,
			loadedData: objClone(this.loadedData),
		});
	}
}

export function isEntryRoute(route: any): route is EntryRoute {
	return (
		typeof route === 'object' &&
		route !== null &&
		route instanceof EntryRoute
	);
}
