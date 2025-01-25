import { QueryOptions } from 'crelte';
import { GraphQl, GraphQlQuery } from 'crelte/graphql';

export default class CrelteServer {
	private _env: Map<string, string>;
	private _graphQl: GraphQl;
	private _req: Request | null;
	private _params: Record<string, string>;

	constructor(
		env: Map<string, string>,
		graphQl: GraphQl,
		req: Request | null,
		params: Record<string, string>,
	) {
		this._env = env;
		this._graphQl = graphQl;
		this._req = req;
		this._params = params;
	}

	/**
	 * Get the GraphQl instance
	 */
	get graphQl(): GraphQl {
		return this._graphQl;
	}

	/**
	 * returns the url params from the request
	 *
	 * @example
	 * ```js
	 * router.get('/blog/:slug', async (cs, req) => {
	 *     return Response.json({ slug: cs.getParam('slug') });
	 * });
	 * ```
	 */
	getParam(name: string): string | null {
		return this._params[name] ?? null;
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
			route: this._req ? new URL(this._req.url) : undefined,
			...opts,
		});
	}
}
