import ServerRouter from '../server/ServerRouter.js';

export const vars = {
	any: (): QueryVar<any> => new QueryVar(),
	number: (): QueryVar<number> => new QueryVar().number(),
	string: (): QueryVar<string> => new QueryVar().string(),

	/**
	 * Id is almost the same as number but will also parse
	 * strings, but only allow non negative integers
	 *
	 * ## Warning
	 * Ids are not automatically safe to be cached
	 * you need to validate the response to make sure filters
	 * with this id returned something
	 */
	id: (): QueryVar<number> => new QueryVar().id(),

	/**
	 * Ids is an array of ids
	 * it will also convert a single id to an array with one element
	 * the returned array will **never be empty**, but might be null if
	 * allowed. Id's are always non negative integers
	 *
	 * The numbers are always unique and sorted in ascending order
	 *
	 * ## Warning
	 * Ids are not automatically safe to be cached, it is also not
	 * enough to just check if the filter returned some results.
	 * Since for example a `relatedTo` filter works like an `or` and
	 * not an `and` meaning if you request ids `[1,2,3]` and
	 * only 1 and 3 have related entries you will get results
	 * even though id 2 did not return anything.
	 *
	 * To mitigate this you could do a second query with the filtered
	 * ids in the field, and check if the return matches the length.
	 */
	ids: (): QueryVar<number[]> => new QueryVar().ids(),

	siteId: (): QueryVar<number> =>
		new QueryVar()
			.number()
			.validIf(
				(num, router) => !!router.sites.find(site => site.id === num),
			),
};

/// either throw with an error which will get returned in a 400 response or
// return false if the value is not valid
export type ValidIf<T> = (v: T, cs: ServerRouter) => boolean;

export class QueryVar<T = any> {
	private name: string | null;
	private type: 'any' | 'string' | 'number' | 'id' | 'ids';
	private flagNullable: boolean;
	private validIfFn: ValidIf<T>;

	constructor() {
		this.name = null;
		this.type = 'any';
		this.flagNullable = false;
		this.validIfFn = () => true;
	}

	string(): QueryVar<string> {
		this.type = 'string';
		return this as unknown as QueryVar<string>;
	}

	number(): QueryVar<number> {
		this.type = 'number';
		return this as unknown as QueryVar<number>;
	}

	id(): QueryVar<number> {
		this.type = 'id';
		return this as unknown as QueryVar<number>;
	}

	ids(): QueryVar<number[]> {
		this.type = 'ids';
		return this as unknown as QueryVar<number[]>;
	}

	nullable(): QueryVar<T | null> {
		this.flagNullable = true;
		return this as QueryVar<T | null>;
	}

	/**
	 * Set a validation function for this variable
	 *
	 * If the value is allowed to be null and it is null
	 * valid will not be called.
	 */
	validIf(fn: ValidIf<T>): QueryVar<T> {
		this.validIfFn = fn;
		return this;
	}

	validValue(v: any, cs: ServerRouter): T | null {
		// undefined is treated as null
		if (typeof v === 'undefined') v = null;

		if (v === null) {
			if (!this.flagNullable)
				throw new Error(`variable ${this.name} cannot be null`);

			return null;
		}

		switch (this.type) {
			case 'any':
				break;

			case 'string':
				if (typeof v !== 'string')
					throw new Error(`variable ${this.name} is not a string`);
				break;

			case 'number':
				if (typeof v !== 'number')
					throw new Error(`variable ${this.name} is not a number`);
				break;

			case 'id':
				if (typeof v === 'string') v = Number(v);

				if (!isValidId(v))
					throw new Error(`variable ${this.name} is not a valid id`);
				break;

			case 'ids':
				if (typeof v === 'string' || typeof v === 'number') v = [v];

				if (!Array.isArray(v))
					throw new Error(
						`variable ${this.name} is not an id or a list of ids`,
					);

				if (v.length <= 0) {
					if (this.flagNullable) return null;
					throw new Error(
						`variable ${this.name} is not allowed to be empty`,
					);
				}

				// convert strings to numbers
				v = v.map(Number);

				if (!v.every(isValidId))
					throw new Error(
						`variable ${this.name} is not a list of valid ids`,
					);

				// make unique and sort by number
				v = Array.from(new Set(v as number[])).sort((a, b) => a - b);
				break;

			default:
				throw new Error('uknown type ' + this.type);
		}

		if (!this.validIfFn(v, cs))
			throw new Error(`variable ${this.name} is not valid`);

		return v;
	}

	/**
	 * @hidden
	 * Internal method to set the name of the variable
	 */
	z_setName(name: string): QueryVar<T> {
		this.name = name;
		return this;
	}

	__QueryVar__() {}
}

export function isQueryVar(v: any): v is QueryVar {
	return v && typeof v === 'object' && typeof v.__QueryVar__ === 'function';
}

// does not do string to number conversion
function isValidId(id: any): id is number {
	return typeof id === 'number' && Number.isInteger(id) && id >= 0;
}

/**
 * Checks if two id arrays are equal
 *
 * The first argument needs to come from a `vars.ids()` variable.
 * The second argument should come from a query, where the output is trusted.
 *
 * ## Example
 * ```
 * export const variables = {
 *     categories: vars.ids()
 * };
 *
 * export const caching: Caching<typeof variables> = (res, vars) => {
 *     // res is the graphql response
 *     return varsIdsEqual(vars.categories, res.categories);
 * };
 * ```
 *
 * ## Note
 * The following cases are considered equal:
 * ```
 * varsIdsEqual(null, null);
 * varsIdsEqual([], null);
 * varsIdsEqual([1,2], ['2',1]);
 * ```
 * These are not equal:
 * ```
 * varsIdsEqual([1], null);
 * varsIdsEqual([2,1], [2,1]); // because the second arg gets ordered
 * ```
 */
export function varsIdsEqual(
	a: number[] | null | undefined,
	b: (string | number)[] | null | undefined,
): boolean {
	const aEmpty = !a?.length;
	const bEmpty = !b?.length;
	if (aEmpty && bEmpty) return true;
	if (aEmpty || bEmpty) return false;

	if (a.length !== b.length) return false;

	const nb = b.map(Number).sort((a, b) => a - b);

	return a.every((v, i) => v === nb[i]);
}
