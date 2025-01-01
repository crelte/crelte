import { GraphQlQuery } from './CrelteRouted.js';
import { GraphQlRequestOptions } from './graphql/GraphQl.js';

// todo or name it CrelteCommon, CrelteShared?
export default interface CrelteBase {
	/// calling this from loadGlobalData will always return null
	/// this does return the resolved store
	getGlobal(name: string): any | null;

	/**
	 * Run a GraphQl Query
	 *
	 * @param query the default export from a graphql file
	 * @param variables variables that should be passed to the
	 * graphql query
	 * @param options opts `{ caching: true, previewToken: string,
	 * siteToken: string, ignoreStatusCode: false, headers: {} }`
	 */
	query(
		query: GraphQlQuery,
		variables?: Record<string, unknown>,
		opts?: GraphQlRequestOptions,
	): Promise<unknown>;
}
