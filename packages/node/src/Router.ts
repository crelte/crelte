import { Methods, Pattern, Trouter } from 'trouter';
import CrelteServer from './CrelteServer.js';
import { GraphQl } from 'crelte/graphql';
import { SsrCache } from 'crelte/ssr';

export type Handler = (
	cr: CrelteServer,
	req: Request,
) => Promise<Response | null | undefined> | Response | null | undefined;

export default class Router {
	private endpointUrl: string;
	private env: Map<string, string>;
	private crelteServer: CrelteServer;
	private inner: Trouter<Handler>;

	constructor(endpointUrl: string, env: Map<string, string>) {
		this.endpointUrl = endpointUrl;
		this.env = env;
		this.crelteServer = new CrelteServer(
			env,
			new GraphQl(endpointUrl, new SsrCache()),
			null,
			{},
		);
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

	/**
	 * Returns a CrelteServer instance if you wan't to run a query in the routes
	 * setup for example
	 */
	get crelte(): CrelteServer {
		return this.crelteServer;
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
	 * returns an env variable from the craft/.env file.
	 */
	getEnv(name: 'ENDPOINT_URL'): string;
	getEnv(name: 'CRAFT_WEB_URL'): string;
	getEnv(name: string): string | null;
	getEnv(name: string): string | null {
		return this.crelte.getEnv(name) ?? null;
	}

	/** @hidden */
	async _handle(req: Request): Promise<Response | null> {
		const { params, handlers } = this.inner.find(
			req.method as Methods,
			new URL(req.url).pathname,
		);

		if (!handlers.length) return null;

		const crelte = new CrelteServer(
			this.env,
			new GraphQl(this.getEnv('ENDPOINT_URL')!, new SsrCache()),
			req,
			params,
		);

		for (const handler of handlers) {
			const res = await handler(crelte, req);
			if (res) return res;
		}

		return null;
	}
}
