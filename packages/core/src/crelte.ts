import { Cookies } from './cookies/index.js';
import GraphQl, { GraphQlQuery } from './graphql/GraphQl.js';
import Globals from './loadData/Globals.js';
import Events from './plugins/Events.js';
import Plugins, { Plugin } from './plugins/Plugins.js';
import type Route from './routing/Route.js';
import type Request from './routing/Request.js';
import Router from './routing/Router.js';
import SsrCache from './ssr/SsrCache.js';
import { type CrelteRequest } from './index.js';
import { circles } from './utils.js';
import BaseRouter from './routing/BaseRouter.js';
import { Readable } from 'crelte-std/stores';
import Site from './routing/Site.js';
import { Entry } from './entry/index.js';

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
	debugGraphQl?: boolean;

	/**
	 * Enable request and render timing measurement
	 * @default false
	 */
	debugTiming?: boolean;
};

export function configToRequired(config: Config = {}): Required<Config> {
	return {
		preloadOnMouseOver: config.preloadOnMouseOver ?? false,
		viewTransition: config.viewTransition ?? false,
		playIntro: config.playIntro ?? false,
		XCraftSiteHeader: config.XCraftSiteHeader ?? false,
		debugGraphQl: config.debugGraphQl ?? false,
		debugTiming: config.debugTiming ?? false,
	};
}

// export class CrelteBuilder {
// 	config: Config;
// 	ssrCache: SsrCache;
// 	plugins: Plugins;
// 	events: Events;
// 	graphQl?: GraphQl;
// 	router?: Router;
// 	globals: Globals;
// 	cookies?: Cookies;

// 	constructor(config: Config) {
// 		this.config = { ...defaultConfig, ...config };

// 		this.ssrCache = new SsrCache();
// 		this.plugins = new Plugins();
// 		this.events = new Events();
// 		this.globals = new Globals();
// 	}

// 	setupGraphQl(endpoint: string) {
// 		this.graphQl = new GraphQl(endpoint, this.ssrCache, {
// 			XCraftSiteHeader: this.config.XCraftSiteHeader,
// 			debug: this.config.debugGraphQl,
// 			debugTiming: this.config.debugTiming,
// 		});
// 	}

// 	setupRouter(router: BaseRouter) {
// 		this.router = new Router(router);
// 	}

// 	setupCookies(cookies: Cookies) {
// 		this.cookies = cookies;
// 	}

// 	build(): Crelte {
// 		return new Crelte(this);
// 	}
// }

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

	/**
	 * A GraphQl Token generated in Craft
	 */
	bearerToken?: string;
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
export type BaseCrelte = {
	/**
	 * Config
	 */
	config: Required<Config>;

	/**
	 * Get the SSR cache
	 */
	ssrCache: SsrCache;

	/**
	 * Get the GraphQl instance
	 */
	graphQl: GraphQl;

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
	 * except ENDPOINT_URL and CRAFT_WEB_URL
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
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
		query: GraphQlQuery,
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
export type Crelte = BaseCrelte & {
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

export type CrelteRequest = BaseCrelte & {
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
	 * you can use `.getGlobal` which does return a Promise
	 */
	getGlobalAsync<T = any>(name: string): Promise<T | null>;

	/**
	 * Run a GraphQl Query
	 *
	 * @param query the default export from a graphql file or the gql`query {}`
	 * function
	 * @param variables variables that should be passed to the
	 * graphql query
	 */
	query(
		query: GraphQlQuery,
		variables?: Record<string, unknown>,
		opts?: QueryOptions,
	): Promise<unknown>;
};

// /**
//  * This is the main class of Crelte and can be accessed
//  * in component initialisation via `getCrelte()`
//  *
//  * Crelte is stateless, which means it is not associated with
//  * a specific route or site. If you need a statefull crelte
//  * use the function `toCrelteRequest`
//  */
// export class CrelteOld {
// 	protected _ssrCache: SsrCache;
// 	protected _graphQl: GraphQl;
// 	protected _router: Router;
// 	protected _plugins: Plugins;
// 	protected _events: Events;
// 	protected _globals: Globals;
// 	protected _cookies: Cookies;

// 	constructor(builder: CrelteBuilder | Crelte) {
// 		if (!builder.graphQl || !builder.router || !builder.cookies)
// 			throw new Error('builder not ready');

// 		this._ssrCache = builder.ssrCache;
// 		this._graphQl = builder.graphQl;
// 		this._router = builder.router;
// 		this._plugins = builder.plugins;
// 		this._events = builder.events;
// 		this._globals = builder.globals;
// 		this._cookies = builder.cookies;
// 	}

// 	/**
// 	 * Get the SSR cache
// 	 */
// 	get ssrCache(): SsrCache {
// 		return this._ssrCache;
// 	}

// 	/**
// 	 * Get the GraphQl instance
// 	 */
// 	get graphQl(): GraphQl {
// 		return this._graphQl;
// 	}

// 	/**
// 	 * Get the Router instance
// 	 */
// 	get router(): Router {
// 		return this._router;
// 	}

// 	/**
// 	 * Get the Plugins instance
// 	 */
// 	get plugins(): Plugins {
// 		return this._plugins;
// 	}

// 	/**
// 	 * Get the Events instance
// 	 */
// 	get events(): Events {
// 		return this._events;
// 	}

// 	/**
// 	 * Get the Globals instance
// 	 */
// 	get globals(): Globals {
// 		return this._globals;
// 	}

// 	/**
// 	 * Get the Cookies instance
// 	 */
// 	get cookies(): Cookies {
// 		return this._cookies;
// 	}

// 	/**
// 	 * Get a Plugin by name
// 	 */
// 	getPlugin(name: string): Plugin | null {
// 		return this.plugins.get(name);
// 	}

// 	/**
// 	 * returns an env variable from the craft/.env file.
// 	 * All env variables need to start with VITE_
// 	 * except ENDPOINT_URL and CRAFT_WEB_URL
// 	 */
// 	getEnv(name: 'ENDPOINT_URL'): string;
// 	getEnv(name: 'CRAFT_WEB_URL'): string;
// 	getEnv(name: string): string | null;
// 	getEnv(name: string): string | null {
// 		return this.ssrCache.get(name);
// 	}

// 	/**
// 	 * returns a store which contains a globalSet
// 	 *
// 	 * ## Note
// 	 * This only works in loadData, in loadGlobalData this will
// 	 * always return null. In that context you should use
// 	 * `CrelteRequest.getGlobalAsync`
// 	 */
// 	getGlobalStore<T = any>(name: string): Readable<T> | null {
// 		return this.globals.getStore(name) ?? null;
// 	}

// 	/**
// 	 * returns a new CrelteRequest instance either with the current
// 	 * route or a provided one
// 	 *
// 	 * ## Note
// 	 * This is useful if you want to create a stateful crelte
// 	 * to use in loadData context
// 	 */
// 	toRequest(req?: Route | Request): CrelteRequest {
// 		// todo can we remove this function or is it still relevant?

// 		// we do this to avoid cyclic dependencies
// 		return circles.requestFromCrelte(this, req);
// 	}

// 	/**
// 	 * Run a GraphQl Query
// 	 *
// 	 * @param query the default export from a graphql file or the gql`query {}`
// 	 * function
// 	 * @param variables variables that should be passed to the
// 	 * graphql query
// 	 */
// 	async query(
// 		query: GraphQlQuery,
// 		variables: Record<string, unknown> = {},
// 		opts: QueryOptions = {},
// 	): Promise<unknown> {
// 		// this function is added as convenience
// 		return this.graphQl.query(query, variables, {
// 			route: this.router.route.get() ?? undefined,
// 			...opts,
// 		});
// 	}

// 	/** @hidden */
// 	_getContext(): Map<string, any> {
// 		const map = new Map();

// 		map.set('crelte', this);

// 		return map;
// 	}
// }

// export default class CrelteRequest extends Crelte {
// 	/**
// 	 * The current request
// 	 *
// 	 * ## Warning
// 	 * Do not override this
// 	 */
// 	req: Request;

// 	constructor(inner: Crelte, req: Request) {
// 		super(inner);

// 		this.req = req;
// 	}

// 	/**
// 	 * Create a CrelteRequest from a Crelte instance
// 	 *
// 	 * If you don't provide a route or request the current route
// 	 * will be used.
// 	 */
// 	static fromCrelte(
// 		inner: Crelte | CrelteRequest,
// 		req?: Route | Request,
// 	): CrelteRequest {
// 		if (inner instanceof CrelteRequest && !req) return inner;

// 		if (!req) {
// 			req = inner.router.route.get() ?? undefined;
// 			// this will only occur in the first loadData call
// 			if (!req) throw new Error('router does not contain a route');
// 		}

// 		return new CrelteRequest(
// 			inner,
// 			req instanceof Request ? req : Request.fromRoute(req),
// 		);
// 	}

// 	/**
// 	 * Get the current request
// 	 * @deprecated
// 	 */
// 	get route(): Request {
// 		console.warn('CrelteRequest.route is deprecated, use .req instead');
// 		return this.req;
// 	}

// 	/**
// 	 * Easy access to this.req.site
// 	 *
// 	 * ## Note
// 	 * The site might not always match with the current route
// 	 * but be the site default site or one that matches the
// 	 * users language.
// 	 */
// 	get site(): Site {
// 		return this.req.site;
// 	}

// 	/**
// 	 * returns a globalSet
// 	 *
// 	 * ## Note
// 	 * This only works in loadData, in loadGlobalData this will
// 	 * always return null. In that context you should use
// 	 * `.getGlobalAsync`
// 	 */
// 	getGlobal<T = any>(name: string): T | null {
// 		return this.globals.get(name);
// 	}

// 	/**
// 	 * Get a globalSet and wait until it is loaded
// 	 *
// 	 * ## Note
// 	 * This is only useful in loadGlobalData in all other cases
// 	 * you can use `.getGlobal` which does return a Promise
// 	 */
// 	async getGlobalAsync<T = any>(name: string): Promise<T | null> {
// 		return this.globals.getAsync(name);
// 	}

// 	// todo we should override getPlugin making it possible for the plugin
// 	// to attach a CrelteRequest to itself
// 	// for that we should call cloneWithRequest(cr: CrelteRequest)

// 	/**
// 	 * Run a GraphQl Query
// 	 *
// 	 * @param query the default export from a graphql file or the gql`query {}`
// 	 * function
// 	 * @param variables variables that should be passed to the
// 	 * graphql query
// 	 */
// 	async query(
// 		query: GraphQlQuery,
// 		variables: Record<string, unknown> = {},
// 		opts: QueryOptions = {},
// 	): Promise<unknown> {
// 		// this function is added as convenience
// 		return this.graphQl.query(query, variables, {
// 			route: this.req,
// 			...opts,
// 		});
// 	}

// 	/** @hidden */
// 	_setRouter(router: Router) {
// 		this._router = router;
// 	}

// 	/** @hidden */
// 	_setGlobals(globals: Globals) {
// 		this._globals = globals;
// 	}
// }

// export function requestFromCrelte(
// 	crelte: Crelte,
// 	req?: Route | Request,
// ): CrelteRequest {
// 	return CrelteRequest.fromCrelte(crelte, req);
// }

// circles.requestFromCrelte = requestFromCrelte;
