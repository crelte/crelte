import { CrelteRequest } from '../crelte.js';
import { isQuery, Query } from '../queries/Queries.js';

export interface LoadDataFn<A1 = any> {
	(cr: CrelteRequest, entryOrBlock: A1, ...args: any[]): Promise<any> | any;
}

export interface LoadDataObj<A1 = any> {
	[key: string]: LoadData<A1>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface LoadDataArray<A1 = any> extends Array<LoadData<A1>> {}

// todo link to the real docs maybe instead of showing an example
// so we can add @type {import('crelte').LoadData}
// maybe enabling markdown might be enough: https://jsdoc.app/plugins-markdown
/**
 * Load data function
 *
 * There are three main ways `loadData` can be defined:
 *
 * #### Object
 * This is the most common way loadData will be used.
 * Each property should be a loadData type, each one is called in parallel.
 * And will be available to your component with the same name.
 * ```js
 * import entriesQuery from '@/queries/entries.graphql';
 * import { loadData as headerLoadData } from '@/layout/header.svelte';
 *
 * export const loadData = {
 *     entries: entriesQuery,
 *     header: headerLoadData
 * };
 * ```
 *
 * #### GraphQl
 * You can just export a graphql query as a loadData type.
 * This will export all queries from the graphql file as properties.
 * ```js
 * import blogsQuery from '@/queries/blogs.graphql';
 *
 * export const loadData = blogsQuery;
 * ```
 *
 * #### Function
 * Using a function gives you the most flexibility but also is the
 * most cumbersome.
 *
 * ```js
 * import articlesQuery from '@/queries/articles.graphql';
 *
 * export async function loadData(cr, entry) {
 *     return await cr.query(articlesQuery, {
 *         category: entry.category
 *     });
 * }
 *
 * // or
 * export const loadData = (cr, entry) => cr.query(articlesQuery, {
 *     category: entry.category
 * });
 *
 * // or if you're in the context of an object
 * export const loadData = {
 *     articles: (cr, entry) => cr.query(articlesQuery, {
 *         category: entry.category
 *     })
 * }
 * ```
 */
export type LoadData<A1 = any> =
	| LoadDataFn<A1>
	| Query
	| LoadDataObj<A1>
	| LoadDataArray<A1>
	| string
	| number
	| null
	| undefined;

// export type LoadData<A1 = any, R = any> =
// 	| ((cr: CrelteRequest, entryOrBlock: A1, ...args: any[]) => Promise<R>)
// 	| GraphQlQuery
// 	| Record<string, LoadData<A1, R>>;

export async function callLoadData<A1 = any>(
	ld: LoadData<A1>,
	cr: CrelteRequest,
	arg1: A1,
	...args: any[]
): Promise<any> {
	// either we have a function
	if (typeof ld === 'function') {
		return await ld(cr, arg1, ...args);
	}

	// or a graphql query
	if (isQuery(ld)) {
		return await cr.query(ld);
	}

	if (ld === null || typeof ld === 'undefined') return null;

	if (Array.isArray(ld)) {
		return await mergeLoadData(...ld)(cr, arg1, ...args);
	}

	// or an object
	if (typeof ld === 'object') {
		const data = await Promise.all(
			Object.values(ld).map(nld => callLoadData(nld, cr, arg1, ...args)),
		);

		return Object.fromEntries(
			Object.keys(ld).map((key, i) => [key, data[i]]),
		);
	}

	return ld;
}

/**
 * Spread the data of two loadData functions.
 *
 * Prefer to use the array syntax.
 *
 * #### Example
 * ```js
 * export const loadData = mergeLoadData(
 *     {
 * 	        filter: (cr) => cr.route.search.get('filter'),
 *     },
 *     (cr) => cr.query(myQuery, { siteId: cr.site.id })
 * );
 * ```
 */
export function mergeLoadData<A1 = any>(
	...lds: LoadData<A1>[]
): LoadDataFn<A1> {
	return async (cr: CrelteRequest, arg1, ...args: any[]) => {
		const datas = await Promise.all(
			lds.map(
				ld => callLoadData(ld, cr, arg1, ...args) as Promise<object>,
			),
		);

		return datas.reduce((acc, data) => ({ ...acc, ...data }), {});
	};
}
