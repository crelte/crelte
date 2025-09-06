import { CrelteRequest } from '../index.js';
import { Query } from '../queries/Queries.js';

export type Entry = {
	sectionHandle: string;
	typeHandle: string;
	[key: string]: any;
};

export type EntryQueryVars = {
	uri: string;
	siteId: number;
	// todo should we allow an entry to have some addition vars?
	// this would also require to modify the caching
	[key: string]: any;
};

export function entryQueryVars(cr: CrelteRequest): EntryQueryVars {
	if (!cr.req.siteMatches())
		throw new Error(
			'to run the entryQuery the request needs to have a matching site',
		);

	let uri = decodeURI(cr.req.uri);
	if (uri.startsWith('/')) uri = uri.substring(1);
	if (uri === '' || uri === '/') uri = '__home__';

	return {
		uri,
		siteId: cr.site.id,
	};
}

export async function queryEntry(
	cr: CrelteRequest,
	entryQuery: Query,
	vars: EntryQueryVars,
): Promise<Entry> {
	const page = await cr.query(entryQuery, vars);
	return extractEntry(page) ?? ENTRY_ERROR_404;
}

export const ENTRY_ERROR_404: Entry = {
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
	// todo instead of only spreading we should maybe objClone?
	if (page?.entry) return { ...page.entry };
	if (page?.product)
		return {
			sectionHandle: 'product',
			...page.product,
		};

	return null;
}

// todo maybe move everything here to /loadData
