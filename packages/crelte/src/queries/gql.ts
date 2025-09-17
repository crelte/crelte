import { isQuery, Query } from './Queries.js';

/**
 * Create a GraphQL query string with variables.
 * @param strings
 * @param keys
 *
 * ## Example
 * ```
 * const query = gql`query ($id: ID!) { page(id: $id) { id } }`;
 * ```
 */
export function gql(
	strings: TemplateStringsArray | string[] | string,
	...keys: unknown[]
): Query {
	if (typeof strings === 'string') strings = [strings];

	let query = '';
	strings.forEach((string, i) => {
		query += string;

		if (typeof keys[i] !== 'undefined') {
			const variable = keys[i];

			// nesting support
			if (isQuery(variable) && 'query' in variable) {
				query += variable.query;
			} else if (typeof variable === 'string') {
				query += variable;
			} else {
				console.error('invalid key', variable);
				throw new Error('Invalid key: ' + typeof variable);
			}
		}
	});

	return { query, path: import.meta.url };
}
