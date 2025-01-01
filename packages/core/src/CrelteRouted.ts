import { Cookies } from './cookies/index.js';
import Crelte from './Crelte.js';
import CrelteBase from './CrelteBase.js';
import GraphQl, { GraphQlRequestOptions } from './graphql/GraphQl.js';
import type Globals from './loadData/Globals.js';
import type Events from './plugins/Events.js';
import Plugins, { Plugin } from './plugins/Plugins.js';
import Route from './routing/Route.js';
import Router from './routing/Router.js';
import Site from './routing/Site.js';
import SsrCache from './ssr/SsrCache.js';

export type GraphQlQuery = {
	path?: string;
	query: string;
};

export default class CrelteRouted implements CrelteBase {
	route: Route;
	site: Site;

	private inner: Crelte;
	private innerGlobals: Map<string, any>;

	constructor(inner: Crelte, route: Route, site: Site) {
		this.route = route;
		this.site = site;

		this.inner = inner;
		this.innerGlobals = new Map();
	}

	get crelte(): Crelte {
		return this.inner;
	}

	get ssrCache(): SsrCache {
		return this.inner.ssrCache;
	}

	get plugins(): Plugins {
		return this.inner.plugins;
	}

	get events(): Events {
		return this.inner.events;
	}

	get graphQl(): GraphQl {
		return this.inner.graphQl;
	}

	get router(): Router {
		return this.inner.router;
	}

	get globals(): Globals {
		return this.inner.globals;
	}

	get cookies(): Cookies {
		return this.inner.cookies;
	}

	// overload this function to add your plugin type
	getPlugin(name: string): Plugin | null {
		return this.inner.plugins.get(name);
	}

	/**
	 * returns an env Variables, always needs to be prefixed VITE_
	 * Except ENDPOINT_URL and CRAFT_WEB_URL
	 */
	getEnv(name: string): string | null {
		return this.inner.getEnv(name);
	}

	/// calling this from loadGlobalData will always return null
	/// this does return the resolved store
	getGlobal(name: string): any | null {
		return this.innerGlobals.get(name) ?? null;
	}

	/// get a global and wait for it if it is still loaded
	/// this is useful when you need to load a global in the
	/// loadGlobalData function
	async getGlobalAsync(name: string): Promise<any | null> {
		const global = this.innerGlobals.get(name);
		if (global) return global;

		const r = await this.inner.globals.getAsync(name);
		if (!r) return null;

		return r.bySiteId(this.site.id);
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
		const search = this.route.search;

		if (search.has('token') && search.get('x-craft-live-preview')) {
			opts.previewToken = search.get('token')!;
		} else if (search.has('siteToken')) {
			opts.siteToken = search.get('siteToken')!;
		}

		opts.path = query.path;

		return await this.graphQl.request(query.query, variables, opts);
	}

	// hidden
	_globalDataLoaded() {
		this.innerGlobals = this.inner.globals._globalsBySite(this.site.id);
	}
}
