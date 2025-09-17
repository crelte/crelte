import { Pattern, Trouter } from 'trouter';
import { Crelte, CrelteRequest } from '../crelte.js';
import { Plugin, PluginCreator } from '../plugins/Plugins.js';
import { getCrelte } from '../index.js';
import { Entry } from '../loadData/index.js';

export type CrelteStaticRequest = CrelteRequest & {
	params: Map<string, string>;

	/**
	 * returns the url params from the request
	 *
	 * @example
	 * ```js
	 * router.add('/blog/:slug', async (csr) => {
	 *     const blogData = await fetchBlogData(csr.getParam('slug'));
	 *
	 *     return {
	 *         sectionHandle: 'blog',
	 *         typeHandle: 'post',
	 *         ...blogData
	 *     };
	 * });
	 * ```
	 */
	getParam(name: string): string | null;
};

export type StaticRouteHandler = (
	csr: CrelteStaticRequest,
) => Promise<Entry | null | undefined> | Entry | null | undefined | void;

export class StaticRouter implements Plugin {
	private inner: Trouter<StaticRouteHandler>;

	constructor(crelte: Crelte) {
		this.inner = new Trouter();

		crelte.events.on('loadEntry', cr => this.handle(cr));
	}

	get name(): string {
		return 'staticRouter';
	}

	add(pattern: Pattern, ...handlers: StaticRouteHandler[]): this {
		this.inner.add('GET', pattern, ...handlers);
		return this;
	}

	private async handle(cr: CrelteRequest): Promise<Entry | null> {
		const { params, handlers } = this.inner.find('GET', cr.req.uri);

		if (!handlers.length) return null;

		const nParams = new Map(Object.entries(params));

		const csr: CrelteStaticRequest = {
			...cr,
			params: nParams,
			getParam: (name: string): string | null =>
				nParams.get(name) ?? null,
		};

		for (const handler of handlers) {
			const res = await handler(csr);
			if (res) return res;
		}

		return null;
	}
}

export function createStaticRouter(): PluginCreator {
	return crelte => new StaticRouter(crelte);
}

export function getStaticRouter(crelte?: Crelte): StaticRouter {
	crelte = crelte ?? getCrelte();
	return crelte.getPlugin('staticRouter') as StaticRouter;
}
