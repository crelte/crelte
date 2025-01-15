import Route from '../routing/Route.js';
import SsrCache, { calcKey as ssrCacheCalcKey } from '../ssr/SsrCache.js';

export type GraphQlErrorResponse = {
	status?: number;
	body?: string;
};

/**
 * A GraphQL query
 *
 * You should almost never create this object directly
 * but instead import a graphql file or use the gql template.
 */
export interface GraphQlQuery {
	path?: string;
	query: string;
}

// todo improve this
/**
 * A GraphQL error
 */
export class GraphQlError extends Error {
	resp: GraphQlErrorResponse;
	ctx: any;

	// ctx might be anything
	constructor(resp: GraphQlErrorResponse, ctx: any = null) {
		super();

		this.resp = resp;
		this.ctx = ctx;
	}

	/**
	 * The status code of the response
	 */
	status(): number {
		return this.resp?.status ?? 500;
	}

	__isGraphQlError__() {}

	/**
	 * The error message in string form
	 */
	get message(): string {
		return 'GraphqlError: ' + JSON.stringify(this.resp);
	}
}

/**
 * Options for the GraphQl class
 */
export type GraphQlOptions = {
	debug?: boolean;
	debugTiming?: boolean;
};

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
export type GraphQlRequestOptions = {
	path?: string;
	route?: Route;
	ignoreStatusCode?: boolean;
	previewToken?: string;
	siteToken?: string;
	caching?: boolean;
	headers?: Record<string, string>;
	// will be set by the request function
	status?: number;
};

/**
 * A GraphQL client
 */
export default class GraphQl {
	private endpoint: string;
	private ssrCache: SsrCache;
	private listeners: Map<
		string,
		[(resp: unknown) => void, (error: unknown) => void][]
	>;

	private loggingRequests: boolean;
	private loggingTiming: boolean;

	/**
	 * Create a new GraphQL client
	 */
	constructor(
		endpoint: string,
		ssrCache: SsrCache,
		opts: GraphQlOptions = {},
	) {
		this.endpoint = endpoint;
		this.ssrCache = ssrCache;
		this.listeners = new Map();

		this.loggingRequests = opts?.debug ?? false;
		this.loggingTiming = opts?.debugTiming ?? false;
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
		opts: GraphQlRequestOptions = {},
	): Promise<unknown> {
		if (opts.route) {
			const search = opts.route.search;

			// todo should variables contain siteId
			// or maybe gql should detect loadData and add it there
			// it might make export const loadData = query; easier

			if (search.has('token') && search.get('x-craft-live-preview')) {
				opts.previewToken = search.get('token')!;
			} else if (search.has('siteToken')) {
				opts.siteToken = search.get('siteToken')!;
			}
		}

		opts.path = query.path;

		return await this.request(query.query, variables, opts);
	}

	// returns {} or throws
	// options: {ignoreStatusCode, previewToken, caching, headers}
	private async request(
		query: string,
		variables: Record<string, unknown> = {},
		options: GraphQlRequestOptions = {},
	): Promise<unknown> {
		let key;
		if (options?.caching ?? true) {
			key = await ssrCacheCalcKey({ query, variables });

			const inCache = this.ssrCache.get(key);
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
			const resp = await this.rawRequest(query, variables, options);
			if (key) {
				this.ssrCache.set(key, resp);

				// ! because the listeners get's in the previous if statement and will
				// always be set when the key is set
				const listeners = this.listeners.get(key)!;
				listeners.forEach(([resolve, _error]) => {
					resolve(resp);
				});

				this.listeners.delete(key);
			}

			return resp;
		} catch (e: unknown) {
			if (key) {
				// ! because the listeners get's in the previous if statement and will
				// always be set when the key is set
				const listeners = this.listeners.get(key)!;
				listeners.forEach(([_resolve, error]) => {
					error(e);
				});

				this.listeners.delete(key);
			}

			throw e;
		}
	}

	// status will be set in opts
	private async rawRequest(
		query: string,
		variables: Record<string, unknown> = {},
		opts: GraphQlRequestOptions = {},
	) {
		opts.ignoreStatusCode = opts.ignoreStatusCode ?? false;

		let url = this.endpoint;

		if (opts?.previewToken) url += '?token=' + opts.previewToken;
		else if (opts?.siteToken) url += '?siteToken=' + opts.siteToken;

		const headers = opts?.headers ?? {};
		headers['Content-Type'] = 'application/json';

		if (this.loggingRequests) {
			console.log('query to ', url, variables, opts);
			headers['X-Debug'] = 'enable';
		}

		let timing;
		if (this.loggingTiming) timing = Date.now();

		const resp = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				query,
				variables,
			}),
		});

		if (opts.ignoreStatusCode) {
			opts.status = resp.status;
		} else if (!resp.ok) {
			throw new GraphQlError(
				{
					status: resp.status,
					body: await resp.text(),
				},
				'resp not ok',
			);
		}

		if (resp.headers.get('x-debug-link'))
			console.log('Debug link', resp.headers.get('x-debug-link'));

		if (timing) {
			console.log(
				'request ' +
					opts.path +
					' vars: ' +
					JSON.stringify(variables) +
					' took ' +
					(Date.now() - timing) +
					'ms',
			);
		}

		let jsonResp;
		try {
			jsonResp = await resp.json();
		} catch (e: unknown) {
			throw new GraphQlError(
				{
					status: resp.status,
				},
				e,
			);
		}

		if ('errors' in jsonResp) {
			console.log('graphql errors', jsonResp.errors);
			throw new GraphQlError(
				{
					status: resp.status,
				},
				jsonResp.errors,
			);
		}

		return jsonResp.data ?? null;
	}
}

/** Returns true if the passed object is a GraphQlQuery */
export function isGraphQlQuery(obj: any): obj is GraphQlQuery {
	return (
		typeof obj === 'object' && obj !== null && typeof obj.query === 'string'
	);
}

/**
 * Create a GraphQL query string with variables.
 * @param strings
 * @param keys
 *
 * ## Example
 * ```
 * const query = gql`query ($id: ID!) { page(id: $id) { id } }`;
 * ```
 */
export function gql(
	strings: TemplateStringsArray | string[] | string,
	...keys: unknown[]
): GraphQlQuery {
	if (typeof strings === 'string') strings = [strings];

	let query = '';
	strings.forEach((string, i) => {
		query += string;

		if (typeof keys[i] !== 'undefined') {
			const variable = keys[i];

			// nesting support
			if (isGraphQlQuery(variable)) {
				query += variable.query;
			} else if (typeof variable === 'string') {
				query += variable;
			} else {
				console.error('invalid key', variable);
				throw new Error('Invalid key: ' + typeof variable);
			}
		}
	});

	return { query, path: import.meta.url };
}
