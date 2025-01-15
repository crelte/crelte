import Crelte, { QueryOptions } from './Crelte.js';
import { GraphQlQuery } from './graphql/GraphQl.js';
import Site from './routing/Site.js';
import Request from './routing/Request.js';
import Route from './routing/Route.js';
import { GlobalData } from './loadData/Globals.js';

export default class CrelteRequest extends Crelte {
	/**
	 * The current request
	 */
	req: Request;

	/**
	 * The current site
	 */
	site: Site;

	private innerGlobals: Map<string, any>;

	/// requires a site if the route does not contain a site
	constructor(inner: Crelte, req: Request, site: Site) {
		super(inner);

		this.req = req;
		this.site = site;
		this.innerGlobals = new Map();
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
		inner: Crelte,
		req?: Route | Request,
		site?: Site,
	): CrelteRequest {
		if (!req) {
			req = inner.router.route.get();
		}

		if (!site) {
			if (!req.site) throw new Error('site is required');
			site = req.site;
		}

		return new CrelteRequest(
			inner,
			req instanceof Request ? req : Request.fromRoute(req),
			site,
		);
	}

	/**
	 * Get the current request
	 * @deprecated
	 */
	get route(): Request {
		return this.req;
	}

	/**
	 * returns a globalSet
	 *
	 * ## Note
	 * This only works in loadData, in loadGlobalData this will
	 * always return null. In that context you should use
	 * `.getGlobalAsync`
	 */
	getGlobal<T extends GlobalData>(name: string): T | null {
		return this.innerGlobals.get(name) ?? null;
	}

	/**
	 * Get a globalSet and wait until it is loaded
	 *
	 * ## Note
	 * This is only useful in loadGlobalData in all other cases
	 * you can use `.getGlobal` which does return a Promise
	 */
	async getGlobalAsync<T extends GlobalData>(
		name: string,
	): Promise<T | null> {
		const global = this.innerGlobals.get(name);
		if (global) return global;

		const r = await this.globals.getAsync<T>(name);
		if (!r) return null;

		return r.bySiteId(this.site.id);
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

	/** @hidden */
	_globalDataLoaded() {
		this.innerGlobals = this.globals._globalsBySite(this.site.id);
	}
}
