import { Methods, Pattern, Trouter } from 'trouter';
import CrelteServerRequest from './CrelteServer.js';
import { GraphQl, GraphQlQuery } from 'crelte/graphql';
import { SsrCache } from 'crelte/ssr';
import ServerRequest from './Request.js';
import { QueryOptions } from 'crelte';
import { SiteFromGraphQl } from './server.js';
import { Site } from 'crelte/routing';

export type Handler = (
	csr: CrelteServerRequest,
) => Promise<Response | null | undefined> | Response | null | undefined;

export default class Router {
	private endpointUrl: string;
	private env: Map<string, string>;
	private _graphQl: GraphQl;
	private _sites: Site[];
	private inner: Trouter<Handler>;

	constructor(
		endpointUrl: string,
		env: Map<string, string>,
		sites: SiteFromGraphQl[],
	) {
		this.endpointUrl = endpointUrl;
		this.env = env;
		this._graphQl = new GraphQl(endpointUrl, new SsrCache());
		this._sites = sites.map(site => new Site(site));
		this.inner = new Trouter();

		this.all = this.add.bind(this, '' as Methods);
		this.get = this.add.bind(this, 'GET');
		this.head = this.add.bind(this, 'HEAD');
		this.patch = this.add.bind(this, 'PATCH');
		this.options = this.add.bind(this, 'OPTIONS');
		this.connect = this.add.bind(this, 'CONNECT');
		this.delete = this.add.bind(this, 'DELETE');
		this.trace = this.add.bind(this, 'TRACE');
		this.post = this.add.bind(this, 'POST');
		this.put = this.add.bind(this, 'PUT');
	}

	add(method: Methods, pattern: Pattern, ...handlers: Handler[]): this {
		this.inner.add(method, pattern, ...handlers);
		return this;
	}

	all: (pattern: Pattern, ...handlers: Handler[]) => this;
	get: (pattern: Pattern, ...handlers: Handler[]) => this;
	head: (pattern: Pattern, ...handlers: Handler[]) => this;
	patch: (pattern: Pattern, ...handlers: Handler[]) => this;
	options: (pattern: Pattern, ...handlers: Handler[]) => this;
	connect: (pattern: Pattern, ...handlers: Handler[]) => this;
	delete: (pattern: Pattern, ...handlers: Handler[]) => this;
	trace: (pattern: Pattern, ...handlers: Handler[]) => this;
	post: (pattern: Pattern, ...handlers: Handler[]) => this;
	put: (pattern: Pattern, ...handlers: Handler[]) => this;

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
		return this.env.get(name) ?? null;
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
		return this._graphQl.query(query, variables, opts);
	}

	/** @hidden */
	async _handle(req: Request): Promise<Response | null> {
		const { params, handlers } = this.inner.find(
			req.method as Methods,
			new URL(req.url).pathname,
		);

		const nReq = new ServerRequest(req, new Map(Object.entries(params)));

		if (!handlers.length) return null;

		const csr = new CrelteServerRequest(
			this.env,
			this.sites,
			new GraphQl(this.getEnv('ENDPOINT_URL')!, new SsrCache()),
			nReq,
		);

		for (const handler of handlers) {
			const res = await handler(csr);
			if (res) {
				csr._finishResponse(res);
				return res;
			}
		}

		return null;
	}
}
