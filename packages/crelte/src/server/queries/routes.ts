import { QueryVar } from '../../queries/vars.js';
import CrelteServerRequest from '../CrelteServer.js';
import ServerRouter from '../ServerRouter.js';

export type CacheIfFn = (response: any, vars: Record<string, any>) => boolean;

/// Either throw or return a boolean
export type ValidIfFn = (
	vars: Record<string, any>,
	sr: ServerRouter,
) => void | boolean;

/// Anything other than returning undefined will replace the response
//
// Note that even if you return undefined since the response is by reference
// you're modifications will be reflected
export type TransformFn = (
	response: any,
	vars: Record<string, any>,
	csr: CrelteServerRequest,
) => void | any | Promise<void | any>;

export type HandleFn = (
	csr: CrelteServerRequest,
	vars: Record<string, any>,
) => Promise<any> | any;

/**
 * Returns the validated variables if some vars were defined
 * else just returns all vars
 */
export function validateVars(
	qvars: Record<string, QueryVar> | null,
	vars: any,
	validIfFn: ValidIfFn | null,
	sr: ServerRouter,
): Record<string, any> {
	if (!vars || typeof vars !== 'object')
		throw new Error('expected an object as vars');

	if (!qvars) return vars;

	const nVars: Record<string, any> = {};

	for (const [k, v] of Object.entries(qvars)) {
		nVars[k] = v.validValue(vars[k], sr);
	}

	if (validIfFn) {
		// or throw
		const valid = validIfFn(nVars, sr);
		if (typeof valid === 'boolean' && !valid)
			throw new Error('invalid variables for query');
	}

	return nVars;
}

export function newError(e: any, status: number): Response {
	return new Response((e as Error).message, { status });
}
