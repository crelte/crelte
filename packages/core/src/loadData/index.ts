/**
 *
 */

import type CrelteRouted from '../CrelteRouted.js';
import { isGraphQlQuery, type GraphQlQuery } from '../graphql/GraphQl.js';
import type Globals from './Globals.js';
import type { Global } from './Globals.js';

export type { Globals, Global };

export type LoadData<T> =
	| ((cr: CrelteRouted, ...args: any[]) => Promise<T>)
	| GraphQlQuery
	| T;

export async function callLoadData(
	ld: LoadData<unknown>,
	cr: CrelteRouted,
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
 * 		{
 * 			filter: (cr) => cr.route.search.get('filter'),
 * 		},
 * 		(cr) => cr.query(myQuery, { siteId: cr.site.id })
 * )
 * ```
 */
export function mergeLoadData(...lds: LoadData<object>[]): LoadData<object> {
	return async (cr: CrelteRouted, ...args: any[]) => {
		const datas = await Promise.all(
			lds.map(ld => callLoadData(ld, cr, ...args) as Promise<object>),
		);

		return datas.reduce((acc, data) => ({ ...acc, ...data }), {});
	};
}
