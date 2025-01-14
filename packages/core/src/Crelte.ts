import ClientCookies from './cookies/ClientCookies.js';
import { Cookies } from './cookies/index.js';
import ServerCookies from './cookies/ServerCookies.js';
import GraphQl, {
	GraphQlOptions,
	GraphQlQuery,
	GraphQlRequestOptions,
} from './graphql/GraphQl.js';
import Globals from './loadData/Globals.js';
import Events from './plugins/Events.js';
import Plugins, { Plugin } from './plugins/Plugins.js';
import Router, { RouterOpts } from './routing/Router.js';
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

	setupRouter(sites: SiteFromGraphQl[], opts: RouterOpts = {}) {
		this.router = new Router(sites, opts);
	}

	setupCookies(cookies: string) {
		this.cookies._init(cookies);
	}

	build(): Crelte {
		return new Crelte(this);
	}
}

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

	get ssrCache(): SsrCache {
		return this._ssrCache;
	}

	get graphQl(): GraphQl {
		return this._graphQl;
	}

	get router(): Router {
		return this._router;
	}

	get plugins(): Plugins {
		return this._plugins;
	}

	get events(): Events {
		return this._events;
	}

	get globals(): Globals {
		return this._globals;
	}

	get cookies(): Cookies {
		return this._cookies;
	}

	getPlugin(name: string): Plugin | null {
		return this.plugins.get(name);
	}

	/**
	 * returns an env Variables, always needs to be prefixed VITE_
	 * Except ENDPOINT_URL and CRAFT_WEB_URL
	 */
	getEnv(name: string): string | null {
		return this.ssrCache.get(name);
	}

	/// calling this from loadGlobalData will always return null
	/// this does return the resolved store
	getGlobal(name: string): any | null {
		return this.globals.get(name) ?? null;
	}

	/**
	 * Run a GraphQl Query
	 *
	 * @param query the default export from a graphql file
	 * @param variables variables that should be passed to the
	 * graphql query
	 * @param options opts `{ caching: true, previewToken: string,
	 * siteToken: string, ignoreStatusCode: false, headers: {} }`
	 */
	async query(
		query: GraphQlQuery,
		variables: Record<string, unknown> = {},
		opts: GraphQlRequestOptions = {},
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
