import ClientCookies from './cookies/ClientCookies.js';
import { Cookies } from './cookies/index.js';
import ServerCookies from './cookies/ServerCookies.js';
import GraphQl, {
	GraphQlOptions,
	GraphQlQuery,
	GraphQlRequestOptions,
} from './graphql/GraphQl.js';
import Globals, { Global, GlobalData } from './loadData/Globals.js';
import Events from './plugins/Events.js';
import Plugins, { Plugin } from './plugins/Plugins.js';
import Router, { RouterOptions } from './routing/Router.js';
import { SiteFromGraphQl } from './routing/Site.js';
import SsrCache from './ssr/SsrCache.js';

export class CrelteBuilder {
	ssrCache: SsrCache;
	plugins: Plugins;
	events: Events;
	graphQl?: GraphQl;
	router?: Router;
	globals: Globals;
	cookies: Cookies;

	constructor() {
		this.ssrCache = new SsrCache();
		this.plugins = new Plugins();
		this.events = new Events();
		this.globals = new Globals();
		// @ts-ignore
		this.cookies = import.meta.env.SSR
			? new ServerCookies()
			: new ClientCookies();
	}

	setupGraphQl(endpoint: string, opts: GraphQlOptions = {}) {
		this.graphQl = new GraphQl(endpoint, this.ssrCache, opts);
	}

	setupRouter(sites: SiteFromGraphQl[], opts: RouterOptions = {}) {
		this.router = new Router(sites, opts);
	}

	setupCookies(cookies: string) {
		this.cookies._init(cookies);
	}

	build(): Crelte {
		return new Crelte(this);
	}
}
/**
 * Options to configure the request
 */
export type QueryOptions = {
	/**
	 * Ignore the response status code
	 * @default false
	 */
	ignoreStatusCode?: boolean;

	/**
	 * Configure caching
	 * @default true
	 */
	caching?: boolean;

	/**
	 * Status code of the response
	 * This will be set after the request if
	 * `ignoreStatusCode` is set to `true`
	 */
	status?: number;
};

/**
 * This is the main class of Crelte and can be accessed
 * in component initialisation via `getCrelte()` and is the
 * first parameter in `loadData`
 */
export default class Crelte {
	protected _ssrCache: SsrCache;
	protected _graphQl: GraphQl;
	protected _router: Router;
	protected _plugins: Plugins;
	protected _events: Events;
	protected _globals: Globals;
	protected _cookies: Cookies;

	constructor(builder: CrelteBuilder | Crelte) {
		if (!builder.graphQl || !builder.router)
			throw new Error('builder not ready');

		this._ssrCache = builder.ssrCache;
		this._graphQl = builder.graphQl;
		this._router = builder.router;
		this._plugins = builder.plugins;
		this._events = builder.events;
		this._globals = builder.globals;
		this._cookies = builder.cookies;
	}

	/**
	 * Get the SSR cache
	 */
	get ssrCache(): SsrCache {
		return this._ssrCache;
	}

	/**
	 * Get the GraphQl instance
	 */
	get graphQl(): GraphQl {
		return this._graphQl;
	}

	/**
	 * Get the Router instance
	 */
	get router(): Router {
		return this._router;
	}

	/**
	 * Get the Plugins instance
	 */
	get plugins(): Plugins {
		return this._plugins;
	}

	/**
	 * Get the Events instance
	 */
	get events(): Events {
		return this._events;
	}

	/**
	 * Get the Globals instance
	 */
	get globals(): Globals {
		return this._globals;
	}

	/**
	 * Get the Cookies instance
	 */
	get cookies(): Cookies {
		return this._cookies;
	}

	/**
	 * Get a Plugin by name
	 */
	getPlugin(name: string): Plugin | null {
		return this.plugins.get(name);
	}

	/**
	 * returns an env variable from the craft/.env file.
	 * All env variables need to start with VITE_
	 * except ENDPOINT_URL and CRAFT_WEB_URL
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
	getEnv(name: string): string | null;
	getEnv(name: string): string | null {
		return this.ssrCache.get(name);
	}

	/**
	 * returns a store which contains a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `CrelteRequest.getGlobalAsync`
	 */
	getGlobal<T extends GlobalData>(name: string): Global<T> | null {
		return this.globals.get(name) ?? null;
	}

	/**
	 * Run a GraphQl Query
	 *
	 * @param query the default export from a graphql file or the gql`query {}`
	 * function
	 * @param variables variables that should be passed to the
	 * graphql query
	 */
	async query(
		query: GraphQlQuery,
		variables: Record<string, unknown> = {},
		opts: QueryOptions = {},
	): Promise<unknown> {
		// this function is added as convenience
		return this.graphQl.query(query, variables, {
			route: this.router.route.get(),
			...opts,
		});
	}

	/** @hidden */
	_getContext(): Map<string, any> {
		const map = new Map();

		map.set('crelte', this);

		return map;
	}
}
