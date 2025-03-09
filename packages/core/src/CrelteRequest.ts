import Crelte, { QueryOptions } from './Crelte.js';
import { GraphQlQuery } from './graphql/GraphQl.js';
import Site from './routing/Site.js';
import Request from './routing/Request.js';
import Route from './routing/Route.js';

export default class CrelteRequest extends Crelte {
	/**
	 * The current request
	 */
	req: Request;

	constructor(inner: Crelte, req: Request) {
		super(inner);

		this.req = req;
	}

	/**
	 * Create a CrelteRequest from a Crelte instance
	 *
	 * If you don't provide a route or request the current route
	 * will be used.
	 *
	 * ## Note
	 * If you provide a route it must contain a site or you must
	 * provide one,
	 */
	static fromCrelte(
		inner: Crelte | CrelteRequest,
		req?: Route | Request,
	): CrelteRequest {
		if (inner instanceof CrelteRequest && !req) return inner;

		if (!req) {
			req = inner.router.route.get() ?? undefined;
			// this will only occur in the first loadData call
			if (!req) throw new Error('router does not contain a route');
		}

		return new CrelteRequest(
			inner,
			req instanceof Request ? req : Request.fromRoute(req),
		);
	}

	/**
	 * Get the current request
	 * @deprecated
	 */
	get route(): Request {
		console.warn('CrelteRequest.route is deprecated, use .req instead');
		return this.req;
	}

	/**
	 * Easy access to this.req.site
	 *
	 * ## Note
	 * The site might not always match with the current route
	 * but be the site default site or one that matches the
	 * users language.
	 */
	get site(): Site {
		return this.req.site;
	}

	/**
	 * returns a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `.getGlobalAsync`
	 */
	getGlobal<T = any>(name: string): T | null {
		return this.globals.get(name, this.site.id);
	}

	/**
	 * Get a globalSet and wait until it is loaded
	 *
	 * ## Note
	 * This is only useful in loadGlobalData in all other cases
	 * you can use `.getGlobal` which does return a Promise
	 */
	async getGlobalAsync<T = any>(name: string): Promise<T | null> {
		return this.globals.getAsync(name, this.site.id);
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
			route: this.req,
			...opts,
		});
	}
}
