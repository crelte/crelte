import { Cookies } from './cookies/index.js';
import Globals from './loadData/Globals.js';
import Events from './plugins/Events.js';
import Plugins, { Plugin } from './plugins/Plugins.js';
import { type Route, Request, Router } from './routing/index.js';
import SsrCache from './ssr/SsrCache.js';
import { Readable } from 'crelte-std/stores';
import Site from './routing/Site.js';
import { Entry } from './entry/index.js';
import Queries, { Query, QueryOptions } from './queries/Queries.js';

export type Config = {
	/**
	 * Preload pages on mouse over
	 * @default false
	 */
	preloadOnMouseOver?: boolean;

	/**
	 * Use view transitions
	 * @default false
	 */
	viewTransition?: boolean;

	/**
	 * Play the intro animation
	 * @default false
	 */
	playIntro?: boolean;

	/**
	 * Enable X-Craft-Site Header
	 * @default false
	 */
	XCraftSiteHeader?: boolean;

	// debug

	/**
	 * Enable graphql query debugging
	 * @default false
	 */
	debugQueries?: boolean;

	/**
	 * Enable request and render timing measurement
	 * @default false
	 */
	debugTiming?: boolean;
};

export function configWithDefaults(config: Config = {}): Required<Config> {
	return {
		preloadOnMouseOver: config.preloadOnMouseOver ?? false,
		viewTransition: config.viewTransition ?? false,
		playIntro: config.playIntro ?? false,
		XCraftSiteHeader: config.XCraftSiteHeader ?? false,
		debugQueries: config.debugQueries ?? false,
		debugTiming: config.debugTiming ?? false,
	};
}

/**
 * This is Crelte a container of useful features and functions.
 *
 * In svelte contexts for each of these functions and classes there
 * should be a getter function like `getCrelte()` or `getRouter()`.
 *
 * ## Note
 * Plugins and other instances could modify this type, so when extending cloning
 * or similar use the spread operator instead of naming all "properties".
 */
export type Crelte = {
	/**
	 * Config
	 */
	config: Required<Config>;

	/**
	 * Get the SSR cache
	 */
	ssrCache: SsrCache;

	/**
	 * Get the Queries instance
	 */
	queries: Queries;

	/**
	 * Get the Router instance
	 */
	router: Router;

	/**
	 * Get the Plugins instance
	 */
	plugins: Plugins;

	/**
	 * Get the Events instance
	 */
	events: Events;

	/**
	 * Get the Globals instance
	 */
	globals: Globals;

	/**
	 * Get the Cookies instance
	 */
	cookies: Cookies;

	/**
	 * Get a Plugin by name
	 */
	getPlugin(name: string): Plugin | null;

	/**
	 * returns an env variable from the craft/.env file.
	 * All env variables need to start with VITE_
	 * except ENDPOINT_URL, CRAFT_WEB_URL and FRONTEND_URL
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
	getEnv(name: 'FRONTEND_URL'): string;
	getEnv(name: string): string | null;

	/**
	 * returns a store which contains a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `CrelteRequest.getGlobalAsync`
	 */
	getGlobalStore<T = any>(name: string): Readable<T> | null;

	/**
	 * returns a new CrelteRequest instance either with the current
	 * route or a provided one
	 *
	 * ## Note
	 * This is useful if you want to create a stateful crelte
	 * to use in loadData context
	 */
	toRequest(req?: Route | Request): CrelteRequest;

	/**
	 * Run a GraphQl Query
	 *
	 * @param query the default export from a graphql file or the gql`query {}`
	 * function
	 * @param variables variables that should be passed to the
	 * graphql query
	 */
	query(
		query: Query,
		variables?: Record<string, unknown>,
		opts?: QueryOptions,
	): Promise<unknown>;
};

/**
 * This is Crelte a container of useful features and functions.
 *
 * In svelte contexts for each of these functions and classes there
 * should be a getter function like `getCrelte()` or `getRouter()`.
 *
 * ## Note
 * Plugins and other instances could modify this type, so when extending cloning
 * or similar use the spread operator instead of naming all "properties".
 */
export type CrelteWithRoute = Crelte & {
	/** The route */
	get route(): Readable<Route>;
	get site(): Readable<Site>;
	get entry(): Readable<Entry>;

	/**
	 * returns a store which contains a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `CrelteRequest.getGlobalAsync`
	 */
	getGlobal<T = any>(name: string): Readable<T> | null;
};

export type CrelteRequest = Crelte & {
	/**
	 * The current request
	 */
	req: Request;

	/**
	 * Easy access to this.req.site
	 *
	 * ## Note
	 * The site might not always match with the current route
	 * but be the site default site or one that matches the
	 * users language.
	 */
	get site(): Site;

	/**
	 * returns a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `.getGlobalAsync`
	 */
	getGlobal<T = any>(name: string): T | null;

	/**
	 * Get a globalSet and wait until it is loaded
	 *
	 * ## Note
	 * This is only useful in loadGlobalData in all other cases
	 * you can use `.getGlobal` which does not return a Promise
	 */
	getGlobalAsync<T = any>(name: string): T | Promise<T | null> | null;
};

export function newCrelte({
	config,
	ssrCache,
	plugins,
	events,
	globals,
	router,
	queries,
	cookies,
}: {
	config: Required<Config>;
	ssrCache: SsrCache;
	plugins: Plugins;
	events: Events;
	globals: Globals;
	router: Router;
	queries: Queries;
	cookies: Cookies;
}): Crelte {
	return {
		config,
		ssrCache,
		plugins,
		events,
		globals,
		router,
		queries,
		cookies,

		getPlugin: name => plugins.get(name),
		getEnv: key => ssrCache.get(key as any) as any,
		getGlobalStore: name => globals.getStore(name),
		toRequest(req) {
			// @ts-ignore
			if (this === globalThis)
				throw new Error('need to call toRequest with a this context');
			return crelteToRequest(this, req);
		},
		query: (query, vars, opts) => queries.query(query, vars, opts),
	};
}

export function crelteToRequest(
	crelte: Crelte,
	req?: Route | Request,
): CrelteRequest {
	req = req ?? (crelte as any).req;
	if (!req) {
		req = crelte.router.route.get() ?? undefined;
		// this will only occur in the first loadData call
		if (!req) throw new Error('router does not contain a route');
	}

	return {
		...crelte,
		req: req instanceof Request ? req : Request.fromRoute(req),
		get site() {
			return this.req.site;
		},
		getGlobal: name => crelte.globals.get(name),
		getGlobalAsync: name => crelte.globals.getAsync(name),
		query: (query, vars, opts) => crelte.queries.query(query, vars, opts),
	};
}
