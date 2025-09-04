import { Pattern, Trouter } from 'trouter';
import { Crelte, CrelteRequest, QueryOptions } from '../index.js';
import { CrelteEntryRequest, Entry, EntryRequest } from './index.js';
import { GraphQlQuery } from '../graphql/GraphQl.js';

export type EntryRouteHandler = (
	cr: CrelteEntryRequest,
) => Promise<Entry | null | undefined> | Entry | null | undefined | void;

export type EntryRoutes = (router: EntryRouter) => Promise<void> | void;

export default class EntryRouter {
	private _crelte: Crelte;
	private inner: Trouter<EntryRouteHandler>;

	constructor(crelte: Crelte) {
		this._crelte = crelte;
		this.inner = new Trouter();
	}

	add(pattern: Pattern, ...handlers: EntryRouteHandler[]): this {
		this.inner.add('GET', pattern, ...handlers);
		return this;
	}

	/**
	 * returns an env variable from the craft/.env file.
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
	getEnv(name: string): string | null;
	getEnv(name: string): string | null {
		return this._crelte.getEnv(name);
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
		return this._crelte.graphQl.query(query, variables, opts);
	}

	/** @hidden */
	async _handle(cr: CrelteRequest): Promise<Entry | null> {
		const { params, handlers } = this.inner.find('GET', cr.req.uri);

		if (!handlers.length) return null;

		const req = new EntryRequest(cr.req.url, cr.req.site, {
			params: new Map(Object.entries(params)),
		});
		const cer = { ...cr, req };

		for (const handler of handlers) {
			const res = await handler(cer);
			if (res) return res;
		}

		return null;
	}
}
