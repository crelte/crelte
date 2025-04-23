import { Crelte, CrelteRequest } from '../index.js';
import { Request, RequestOptions, Site } from '../routing/index.js';
import EntryRouter, { EntryRouteHandler, EntryRoutes } from './EntryRouter.js';

export { EntryRouter, type EntryRouteHandler, type EntryRoutes };

export type Entry = {
	sectionHandle: string;
	typeHandle: string;
	[key: string]: any;
};

export type EntryQueryVars = {
	uri: string;
	siteId: number;
	[key: string]: any;
};

export type EntryRequestOptions = RequestOptions & {
	params?: Map<string, string>;
};

export class EntryRequest extends Request {
	private params: Map<string, string>;

	constructor(url: string | URL, site: Site, opts: EntryRequestOptions = {}) {
		super(url, site, opts);

		this.params = opts.params ?? new Map();
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
		return this.params.get(name) ?? null;
	}
}

export class CrelteEntryRequest extends CrelteRequest {
	req: EntryRequest;

	constructor(inner: Crelte, req: EntryRequest) {
		super(inner, req);
		this.req = req;
	}
}
