import Site from '../Site.js';
import { objClone } from '../../utils.js';
import { Entry, LoadData } from '../../loadData/index.js';
import BaseRoute, { RouteOrigin } from './BaseRoute.js';

export type RouteOptions = {
	entryChanged?: boolean;
	scrollY?: number;
	index?: number;
	origin?: RouteOrigin;
	state?: Record<string, any>;
	context?: Record<string, any>;
};

export interface TemplateModule {
	// svelte component
	default: any;

	loadData?: LoadData<Entry>;
}

/**
 * A Route contains information about the current page for example the url,
 * the site and its entry.
 */
export default class Route extends BaseRoute {
	/**
	 * The entry of the route
	 */
	entry: Entry;

	/**
	 * The template module of the route
	 */
	template: TemplateModule;

	/**
	 * The loaded data of the route
	 */
	loadedData: Record<string, any>;

	// todo should this be renamed to data changed? or loadData called?
	/**
	 * Wether the entry changed since the last Route change
	 */
	entryChanged: boolean;

	/**
	 * Create a new Route
	 *
	 * #### Note
	 * This should only be created by crelte
	 */
	constructor(
		url: string | URL,
		site: Site,
		entry: Entry,
		template: TemplateModule,
		loadedData: Record<string, any>,
		opts: RouteOptions = {},
	) {
		super(url, site, opts);

		this.entry = entry;
		this.template = template;
		this.loadedData = loadedData;
		this.entryChanged = opts?.entryChanged ?? true;
	}

	/**
	 * Create a copy of the EntryRoute
	 *
	 * #### Note
	 * This does not make a copy of the entry, template or loadedData.
	 */
	clone() {
		return new Route(
			this.url.href,
			this.site,
			this.entry,
			this.template,
			this.loadedData,
			{
				scrollY: this.scrollY ?? undefined,
				index: this.index,
				origin: this.origin,
				state: objClone(this.z_state),
				context: this.z_context,
			},
		);
	}
}

export function isRoute(route: any): route is Route {
	return (
		typeof route === 'object' && route !== null && route instanceof Route
	);
}
