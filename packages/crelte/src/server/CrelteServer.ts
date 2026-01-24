import { Cookies } from '../cookies/index.js';
import ServerCookies from '../cookies/ServerCookies.js';
import { Queries, Query, QueryOptions } from '../queries/index.js';
import { Request, Site } from '../routing/index.js';
import { urlWithPath } from '../utils.js';
import ServerRequest from './Request.js';

export type CrelteServerRequestOptions = {
	env: Map<string, string>;
	sites: Site[];
	languages: string[];
	preferredSite: Site | null;
	queries: Queries;
};

export default class CrelteServerRequest {
	/**
	 * The current request {@link ServerRequest}
	 */
	req: ServerRequest;

	private _env: Map<string, string>;
	private prefSite: Site | null;
	private _sites: Site[];
	private _langs: string[];
	private _queries: Queries;
	private _cookies: Cookies;

	constructor(req: ServerRequest, opts: CrelteServerRequestOptions) {
		this.req = req;

		this._env = opts.env;
		this._sites = opts.sites;
		this._langs = opts.languages;
		this.prefSite = opts.preferredSite;

		this._queries = opts.queries.z_toRequest(
			new Request(new URL(req.url), req.site),
		);
		this._cookies = new ServerCookies(req.headers);
	}

	/**
	 * Easy access to this.req.site
	 *
	 * #### Note
	 * The site might not always match with the current route
	 * but be the site default site or one that matches the
	 * users language.
	 */
	get site(): Site {
		return this.req.site;
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
	 * The languages which are preferred by the user
	 */
	get preferredLanguages(): string[] {
		return this._langs;
	}

	/**
	 * returns an env variable from the craft/.env file.
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
	getEnv(name: 'FRONTEND_URL'): string;
	getEnv(name: string): string | null;
	getEnv(name: string): string | null {
		return this._env.get(name) ?? null;
	}

	/**
	 * returns the frontend url with an optional path
	 *
	 * #### Note
	 * For the origin the `FRONTEND_URL` env variable is used
	 */
	frontendUrl(path?: string): URL {
		return urlWithPath(this.getEnv('FRONTEND_URL'), path);
	}

	/**
	 * returns the backend url with an optional path
	 *
	 * #### Note
	 * For the origin the `ENDPOINT_URL` env variable is used
	 */
	backendUrl(path?: string): URL {
		return urlWithPath(this.getEnv('ENDPOINT_URL'), path);
	}

	/**
	 * Returns the primary site
	 */
	primarySite(): Site {
		return this._sites.find(s => s.primary) ?? this._sites[0];
	}

	/**
	 * Returns a site which is preferred based on the users language
	 *
	 * Returns null if no site could be determined
	 */
	preferredSite(): Site | null {
		return this.prefSite;
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
	z_finishResponse(resp: Response) {
		(this.cookies as ServerCookies)._populateHeaders(resp.headers);
	}
}
