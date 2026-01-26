import SsrCache, { calcKey as ssrCacheCalcKey } from '../ssr/SsrCache.js';
import { BaseRoute, Request, Route } from '../routing/index.js';
import QueryError from './QueryError.js';
import { Readable } from '../std/stores/index.js';

/**
 * Options for the Queries class
 */
export type QueriesOptions = {
	route?: Readable<Route | null>;
	bearerToken?: string;
	XCraftSiteHeader?: boolean;
	debug?: boolean;
	debugTiming?: boolean;
};

/**
 * A GraphQL query
 *
 * You should almost never create this object directly
 * but instead import a graphql file or use the gql template.
 */
export type Query =
	| {
			path?: string;
			query: string;
	  }
	| {
			queryName: string;
	  };

/** Returns true if the passed object is a GraphQlQuery */
export function isQuery(obj: any): obj is Query {
	if (typeof obj !== 'object' || obj === null) return false;

	return typeof obj.query === 'string' || typeof obj.queryName === 'string';
}

/**
 * Options to configure the request
 *
 * If you use `Crelte*.query` the following options
 * will be set automatically:
 * - path
 * - route
 * - previewToken
 * - siteToken
 */
export type QueryOptions = {
	/**
	 * A GraphQl Token generated in Craft
	 */
	bearerToken?: string;

	/**
	 * Configure caching
	 * @default true
	 */
	caching?: boolean;

	/**
	 * Usually automatically set
	 */
	previewToken?: string;

	/**
	 * Usually automatically set
	 */
	siteToken?: string;
};

/**
 * With queries you can execute GraphQl queries, either directly
 * to the endpoint or via the server queries.
 *
 * By default if you import a graphql file it will be called via the server queries.
 */
export default class Queries {
	private inner: Inner;
	private route: Readable<Route | null> | null;
	// if the request is present, it should be used instead of the route
	private request: Request | null;

	private constructor(
		inner: Inner,
		route: Readable<Route | null> | null,
		request: Request | null,
	) {
		this.inner = inner;
		this.route = route;
		this.request = request;
	}

	/**
	 * Create a new Queries instance
	 *
	 * @param endpoint the craft GraphQl endpoint
	 * @param frontend the frontend url where the server queries are reachable
	 * @param ssrCache the ssrCache to use for caching
	 * @param opts options
	 * @returns
	 */
	static new(
		endpoint: string,
		frontend: string,
		ssrCache: SsrCache,
		opts: QueriesOptions = {},
	): Queries {
		return new Queries(
			new Inner(endpoint, frontend, ssrCache, opts),
			opts?.route ?? null,
			null,
		);
	}

	/**
	 * Run a GraphQl Query
	 *
	 * @param query the default export from a graphql file or the gql`query {}`
	 * function
	 * @param vars variables that should be passed to the
	 * graphql query
	 */
	async query(
		query: Query,
		vars: Record<string, unknown> = {},
		opts: QueryOptions = {},
	): Promise<unknown> {
		const route: BaseRoute | null =
			this.request ?? this.route?.get() ?? null;

		const search = route?.search;
		const previewToken = opts.previewToken ?? search?.get('token') ?? null;
		const siteToken = opts.siteToken ?? search?.get('siteToken') ?? null;
		const bearerToken = opts.bearerToken ?? this.inner.bearerToken ?? null;

		const siteId = route?.siteMatches() ? route.site.id : null;
		const xCraftSiteId = this.inner.XCraftSiteHeader ? siteId : null;

		// for convenience we set the siteId as variable if it is known
		if (siteId !== null) vars = { siteId, ...vars };

		// todo, maybe we should set the XCraftSiteId, with the siteId from vars?

		return this.inner.query(query, vars, {
			previewToken,
			siteToken,
			bearerToken,
			xCraftSiteId,
			caching: opts.caching ?? true,
		});
	}

	/**
	 * @hidden
	 * call this before starting the loadGlobalData phase
	 */
	z_toRequest(req: Request) {
		return new Queries(this.inner, this.route, req);
	}
}

type InnerQueryOptions = {
	previewToken: string | null;
	siteToken: string | null;
	bearerToken: string | null;
	xCraftSiteId: number | null;
	caching: boolean;
};

class Inner {
	endpoint: string;
	frontend: string;
	ssrCache: SsrCache;
	private listeners: Map<
		string,
		[(resp: unknown) => void, (error: unknown) => void][]
	>;

	bearerToken: string | null;
	XCraftSiteHeader: boolean;
	loggingRequests: boolean;
	loggingTiming: boolean;

	constructor(
		endpoint: string,
		frontend: string,
		ssrCache: SsrCache,
		opts: QueriesOptions = {},
	) {
		this.endpoint = endpoint;
		this.frontend = frontend;
		this.ssrCache = ssrCache;
		this.listeners = new Map();

		this.bearerToken = opts?.bearerToken ?? null;
		this.XCraftSiteHeader = opts?.XCraftSiteHeader ?? false;
		this.loggingRequests = opts?.debug ?? false;
		this.loggingTiming = opts?.debugTiming ?? false;
	}

	async query(
		query: Query,
		vars: Record<string, unknown>,
		opts: InnerQueryOptions,
	): Promise<unknown> {
		let key;
		if (opts.caching) {
			// todo the entire query be cached?
			key = await ssrCacheCalcKey({ query, vars });

			const inCache = this.ssrCache.get(key);
			// todo maybe we should objClone here?
			if (inCache) return inCache;

			// check if a listeners exists meaning the same request is already
			// in progress
			const listeners = this.listeners.get(key);
			if (listeners) {
				return new Promise((resolve, error) => {
					listeners.push([resolve, error]);
				});
			}

			// else setup the listener
			this.listeners.set(key, []);
		}

		try {
			const resp = await this.queryNotCached(query, vars, opts);

			if (key) {
				// todo maybe we should objClone here?
				this.ssrCache.set(key, resp);

				// ! (never null) because the listeners get's in the previous
				// if statement and will always be set when the key is set
				const listeners = this.listeners.get(key)!;
				listeners.forEach(([resolve, _error]) => resolve(resp));

				this.listeners.delete(key);
			}

			return resp;
		} catch (e: unknown) {
			if (key) {
				// ! (never null) because the listeners get's in the previous
				// if statement and will always be set when the key is set
				const listeners = this.listeners.get(key)!;
				listeners.forEach(([_resolve, error]) => error(e));

				this.listeners.delete(key);
			}

			throw e;
		}
	}

	async queryNotCached(
		query: Query,
		vars: Record<string, unknown>,
		opts: InnerQueryOptions,
	): Promise<unknown> {
		let logName: string, url: URL;

		if ('queryName' in query) {
			logName = `query (server: ${query.queryName})`;
			url = new URL(this.frontend);
			url.pathname = '/queries/' + query.queryName;
		} else {
			logName = `query (${query.path ?? 'unknown'})`;
			url = new URL(this.endpoint);
		}

		if (opts.previewToken) url.searchParams.set('token', opts.previewToken);
		if (opts.siteToken) url.searchParams.set('siteToken', opts.siteToken);

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (opts.bearerToken)
			headers['Authorization'] = 'Bearer ' + opts.bearerToken;

		if (opts.xCraftSiteId)
			headers['X-Craft-Site'] = opts.xCraftSiteId.toString();

		if (this.loggingRequests) {
			console.log(logName + ' to:', url.toString(), vars, headers);
			headers['X-Debug'] = 'enable';
		}

		let timing;
		if (this.loggingTiming) timing = Date.now();

		let body: any;
		if ('queryName' in query) {
			body = vars;
		} else {
			body = { query: query.query, variables: vars };
		}

		let resp: Response;

		try {
			resp = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			});
		} catch (e: any) {
			throw new Error(`query to '${url}' failed with: ${e.message}`);
		}

		if (!resp.ok) {
			throw new QueryError(
				{ status: resp.status, body: await resp.text() },
				'resp not ok',
			);
		}

		if (resp.headers.get('X-Debug-Link'))
			console.log('Debug link', resp.headers.get('X-Debug-Link'));

		if (timing) {
			console.log(
				logName + ' completed took: ' + (Date.now() - timing) + 'ms',
				vars,
			);
		}

		let jsonResp;
		try {
			jsonResp = await resp.json();
		} catch (e: unknown) {
			throw new QueryError({ status: resp.status }, e);
		}

		if ('errors' in jsonResp) {
			console.error(logName + ' errors', jsonResp.errors);
			throw new QueryError(
				{ status: resp.status, errors: jsonResp.errors },
				'received errors',
			);
		}

		return jsonResp.data ?? null;
	}
}
