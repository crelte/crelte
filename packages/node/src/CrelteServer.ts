import { QueryOptions } from 'crelte';
import { Cookies } from 'crelte/cookies';
import { ServerCookies } from 'crelte/cookies/internal';
import { GraphQl, GraphQlQuery } from 'crelte/graphql';
import ServerRequest from './Request.js';
import { Site } from 'crelte/routing';
import { siteFromUrl } from 'crelte/routing/internal';

export default class CrelteServerRequest {
	/**
	 * The current request
	 */
	req: ServerRequest;

	private _env: Map<string, string>;
	private _sites: Site[];
	private _graphQl: GraphQl;
	protected _cookies: Cookies;

	constructor(
		env: Map<string, string>,
		sites: Site[],
		graphQl: GraphQl,
		req: ServerRequest,
	) {
		this._env = env;
		this._sites = sites;
		this._graphQl = graphQl;
		this.req = req;
		this._cookies = new ServerCookies();
		this._cookies._init(req.headers.get('Cookie') ?? '');
	}

	/**
	 * Get the GraphQl instance
	 */
	get graphQl(): GraphQl {
		return this._graphQl;
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
			route: new URL(this.req.url),
			...opts,
		});
	}

	/** @hidden */
	_finishResponse(resp: Response) {
		(this.cookies as ServerCookies)
			._getSetCookiesHeaders()
			.forEach(cookie => resp.headers.append('Set-Cookie', cookie));
	}
}
