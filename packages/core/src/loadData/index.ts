import CrelteRequest from '../CrelteRequest.js';
import { isGraphQlQuery, type GraphQlQuery } from '../graphql/GraphQl.js';
import type Globals from './Globals.js';
import type { Global } from './Globals.js';

export type { Globals, Global };

/**
 * Load data function
 *
 * There are three main ways `loadData` can be defined:
 *
 * ## Object
 * This is the most common way loadData will be used.
 * Each property should be a loadData type, each one is called in parallel.
 * And will be available to your component with the same name.
 * ```
 * export const loadData = {
 *
 * import entriesQuery from '@/queries/entries.graphql';
 * import { loadData as headerLoadData } from '@/layout/header.svelte';
 *
 * export const loadData = {
 *     entries: entriesQuery,
 *     header: headerLoadData
 * };
 * ```
 *
 * ## GraphQl
 * You can just export a graphql query as a loadData type.
 * This will export all queries from the graphql file as properties.
 * ```
 * import blogsQuery from '@/queries/blogs.graphql';
 *
 * export const loadData = blogsQuery;
 *
 * // or another option
 * import { gql } from '@craft-svelte/core/graphql';
 *
 * export const loadData = gql`query {
 *   blogs: entries(section: "blogs") {
 *     title
 *     url
 *  }
 * }`;
 * ```
 *
 * ## Function
 * Using a function gives you the most flexibility but also is the
 * most cumbersome.
 *
 * ```
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

export type LoadData<T> =
	| ((cr: CrelteRequest, ...args: any[]) => Promise<T>)
	| GraphQlQuery
	| T;

export async function callLoadData(
	ld: LoadData<unknown>,
	cr: CrelteRequest,
	...args: any[]
): Promise<unknown> {
	// either we have a function
	if (typeof ld === 'function') {
		return await ld(cr, ...args);
	}

	// or a graphql query
	if (isGraphQlQuery(ld)) {
		return await cr.query(ld);
	}

	// or an object
	if (typeof ld === 'object' && ld !== null) {
		const data = await Promise.all(
			Object.values(ld).map(nld => callLoadData(nld, cr, ...args)),
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
 * ## Example
 * ```
 * export const loadData = mergeLoadData(
 *     {
 * 	        filter: (cr) => cr.route.search.get('filter'),
 *     },
 *     (cr) => cr.query(myQuery, { siteId: cr.site.id })
 * );
 * ```
 */
export function mergeLoadData(...lds: LoadData<object>[]): LoadData<object> {
	return async (cr: CrelteRequest, ...args: any[]) => {
		const datas = await Promise.all(
			lds.map(ld => callLoadData(ld, cr, ...args) as Promise<object>),
		);

		return datas.reduce((acc, data) => ({ ...acc, ...data }), {});
	};
}
