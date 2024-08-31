import ClientCookies from './cookies/ClientCookies.js';
import { Cookies } from './cookies/index.js';
import ServerCookies from './cookies/ServerCookies.js';
import CrelteRouted from './CrelteRouted.js';
import GraphQl, { GraphQlOptions } from './graphql/GraphQl.js';
import Globals from './loadData/Globals.js';
import Events from './plugins/Events.js';
import Plugins from './plugins/Plugins.js';
import Route from './routing/Route.js';
import Router, { RouterOpts } from './routing/Router.js';
import Site, { SiteFromGraphQl } from './routing/Site.js';
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
	ssrCache: SsrCache;
	graphQl: GraphQl;
	router: Router;
	plugins: Plugins;
	events: Events;
	globals: Globals;
	cookies: Cookies;

	constructor(builder: CrelteBuilder) {
		if (!builder.graphQl || !builder.router)
			throw new Error('builder not ready');

		this.ssrCache = builder.ssrCache;
		this.graphQl = builder.graphQl;
		this.router = builder.router;
		this.plugins = builder.plugins;
		this.events = builder.events;
		this.globals = builder.globals;
		this.cookies = builder.cookies;
	}

	/**
	 * returns an env Variables, always needs to be prefixed VITE_
	 * Except ENDPOINT_URL and CRAFT_WEB_URL
	 */
	getEnv(name: string): string | null {
		return this.ssrCache.get(name);
	}

	/// requires a site if the route does not contain a site
	toRouted(route?: Route, site?: Site): CrelteRouted {
		if (!route) {
			route = this.router.route.get();
		}

		if (!site) {
			if (!route.site) throw new Error('site is required');
			site = route.site;
		}

		return new CrelteRouted(this, route, site);
	}

	// don't use
	_getContext(): Map<string, any> {
		const map = new Map();

		map.set('crelte', this);

		return map;
	}
}
