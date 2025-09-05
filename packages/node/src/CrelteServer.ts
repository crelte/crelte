import { Cookies } from 'crelte/cookies';
import { ServerCookies } from 'crelte/cookies/internal';
import ServerRequest from './Request.js';
import { Request, Site } from 'crelte/routing';
import { siteFromUrl } from 'crelte/routing/internal';
import { Queries, Query, QueryOptions } from 'crelte/queries';

export default class CrelteServerRequest {
	/**
	 * The current request
	 */
	req: ServerRequest;

	private _env: Map<string, string>;
	private _sites: Site[];
	private _queries: Queries;
	protected _cookies: Cookies;

	constructor(
		env: Map<string, string>,
		sites: Site[],
		queries: Queries,
		req: ServerRequest,
	) {
		this._env = env;
		this._sites = sites;
		this._queries = queries._toRequest(
			new Request(new URL(req.url), sites[0]),
		);
		this.req = req;
		this._cookies = new ServerCookies(req.headers.get('Cookie') ?? '');
	}

	/**
	 * Get the Queries instance
	 */
	get graphQl(): Queries {
		return this._queries;
	}

	/**
	 * Get the Cookies instance
	 */
	get cookies(): Cookies {
		return this._cookies;
	}

	/**
	 * The sites which are available
	 */
	get sites(): Site[] {
		return this._sites;
	}

	/**
	 * returns an env variable from the craft/.env file.
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
	getEnv(name: string): string | null;
	getEnv(name: string): string | null {
		return this._env.get(name) ?? null;
	}

	/**
	 * Get the site from a url
	 */
	getSiteFromUrl(url: string | URL): Site | null {
		url = typeof url === 'string' ? new URL(url) : url;

		return siteFromUrl(url, this.sites);
	}

	/**
	 * Run a Queries Query
	 *
	 * @param query the default export from a graphql file or the gql`query {}`
	 * function
	 * @param variables variables that should be passed to the
	 * graphql query
	 */
	async query(
		query: Query,
		variables: Record<string, unknown> = {},
		opts: QueryOptions = {},
	): Promise<unknown> {
		return this.graphQl.query(query, variables, opts);
	}

	/** @hidden */
	_finishResponse(resp: Response) {
		(this.cookies as ServerCookies)
			._getSetCookiesHeaders()
			.forEach(cookie => resp.headers.append('Set-Cookie', cookie));
	}
}
