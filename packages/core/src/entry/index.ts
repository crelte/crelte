import { GraphQlQuery } from '../graphql/index.js';
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

export async function queryEntry(
	cr: CrelteRequest,
	entryQuery: GraphQlQuery,
): Promise<Entry> {
	if (!cr.req.siteMatches())
		throw new Error(
			'to run the entryQuery the request needs to have a matching site',
		);

	let uri = decodeURI(cr.req.uri);
	if (uri.startsWith('/')) uri = uri.substring(1);
	if (uri === '' || uri === '/') uri = '__home__';

	const vars = {
		uri,
		siteId: cr.site.id,
	};

	const page = await cr.query(entryQuery, vars);
	return extractEntry(page) ?? ERROR_404_ENTRY;
}

const ERROR_404_ENTRY: Entry = {
	sectionHandle: 'error',
	typeHandle: '404',
};

/**
 * Get the entry from the page
 *
 * entries should export sectionHandle and typeHandle
 *
 * products should alias productTypeHandle with typeHandle,
 * sectionHandle will be automatically set to product
 */
export function extractEntry(page: any): Entry | null {
	if (page?.entry) return { ...page.entry };
	if (page?.product)
		return {
			sectionHandle: 'product',
			...page.product,
		};

	return null;
}

// todo maybe move everything here to /loadData
