import Router from '../Router.js';

export const vars = {
	any: (): QueryVar<any> => new QueryVar(),
	number: (): QueryVar<number> => new QueryVar().number(),
	string: (): QueryVar<string> => new QueryVar().string(),
	siteId: (): QueryVar<number> =>
		new QueryVar()
			.number()
			.validIf(
				(num, router) => !!router.sites.find(site => site.id === num),
			),
};

/// either throw with an error which will get returned in a 400 response or
// return false if the value is not valid
export type ValidIf<T> = (v: T, cs: Router) => boolean;

export class QueryVar<T = any> {
	private name: string | null;
	private type: 'any' | 'string' | 'number';
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

	validValue(v: any, cs: Router): T | null {
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
	_setName(name: string): QueryVar<T> {
		this.name = name;
		return this;
	}

	__QueryVar__() {}
}

export function isQueryVar(v: any): v is QueryVar {
	return v && typeof v === 'object' && typeof v.__QueryVar__ === 'function';
}
