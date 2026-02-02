import { QueryVar } from '../../queries/vars.js';
import CrelteServerRequest from '../CrelteServer.js';
import ServerRouter from '../ServerRouter.js';

export type CacheIfFn = (response: any, vars: Record<string, any>) => boolean;

/// Anything other than returning undefined will replace the response
//
// Note that even if you return undefined since the response is by reference
// you're modifications will be reflected
export type TransformFn = (
	response: any,
	vars: Record<string, any>,
) => void | any | Promise<void | any>;

export type HandleFn = (
	csr: CrelteServerRequest,
	vars: Record<string, any>,
) => Promise<any> | any;

/**
 * Returns the validated variables if some vars where defined
 * else just returns all vars
 */
export function validateVars(
	qvars: Record<string, QueryVar> | null,
	vars: any,
	cs: ServerRouter,
): Record<string, any> {
	if (!vars || typeof vars !== 'object')
		throw new Error('expected an object as vars');

	if (!qvars) return vars;

	const nVars: Record<string, any> = {};

	for (const [k, v] of Object.entries(qvars)) {
		nVars[k] = v.validValue(vars[k], cs);
	}

	return nVars;
}

export function newError(e: any, status: number): Response {
	return new Response((e as Error).message, { status });
}
