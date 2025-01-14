import Crelte from './Crelte.js';
import { GraphQlQuery, GraphQlRequestOptions } from './graphql/GraphQl.js';
import Site from './routing/Site.js';
import Request from './routing/Request.js';
import Route from './routing/Route.js';
import { GlobalData } from './loadData/Globals.js';

export default class CrelteRequest extends Crelte {
	req: Request;
	site: Site;

	private innerGlobals: Map<string, any>;

	/// requires a site if the route does not contain a site
	constructor(inner: Crelte, req: Route | Request, site: Site) {
		super(inner);

		this.req = req instanceof Request ? req : Request.fromRoute(req);
		this.site = site;
		this.innerGlobals = new Map();
	}

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

		return new CrelteRequest(inner, req, site);
	}

	// deprecated
	get route(): Request {
		return this.req;
	}

	/// get a global and wait for it if it is still loaded
	/// this is useful when you need to load a global in the
	/// loadGlobalData function
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
	 * @param query the default export from a graphql file
	 * @param variables variables that should be passed to the
	 * graphql query
	 * @param options opts `{ caching: true, previewToken: string,
	 * siteToken: string, ignoreStatusCode: false, headers: {} }`
	 */
	async query(
		query: GraphQlQuery,
		variables: Record<string, unknown> = {},
		opts: GraphQlRequestOptions = {},
	): Promise<unknown> {
		// this function is added as convenience
		return this.graphQl.query(query, variables, {
			route: this.req,
			...opts,
		});
	}

	// hidden
	_globalDataLoaded() {
		this.innerGlobals = this.globals._globalsBySite(this.site.id);
	}
}
