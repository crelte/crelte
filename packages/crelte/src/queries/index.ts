import Queries, {
	InlineQuery,
	isQuery,
	namedQuery,
	NamedQuery,
	QueriesOptions,
	Query,
	QueryOptions,
} from '../queries/Queries.js';
import type CrelteServerRequest from '../server/CrelteServer.js';
import { gql } from './gql.js';
import QueryError, { QueryErrorResponse } from './QueryError.js';
import { QueryVar, ValidIf, vars, varsIdsEqual } from './vars.js';

export {
	Queries,
	type QueriesOptions,
	type QueryOptions,
	type Query,
	type InlineQuery as GqlQuery,
	type NamedQuery,
	namedQuery,
	isQuery,
	QueryError,
	type QueryErrorResponse,
	gql,
	vars,
	type ValidIf,
	QueryVar,
	varsIdsEqual,
};

/** @hidden */
export type InferQueryVarType<T> = T extends QueryVar<infer U> ? U : never;

/** @hidden */
export type InferVariableTypes<T> = {
	[K in keyof T]: InferQueryVarType<T[K]>;
};

/**
 * #### Example
 * ```ts
 * import { vars, Caching } from 'crelte/queries';
 *
 * export const variables = {
 *     siteId: vars.siteId(),
 *     category: vars.id()
 * };
 *
 * export const caching: Caching<typeof variables> =
 *     (queryResponse, variables) => !!queryResponse.entries.length;
 * ```
 */
export type Caching<
	T extends Record<string, QueryVar<any>> = Record<string, QueryVar<any>>,
> = boolean | ((response: any, vars: InferVariableTypes<T>) => boolean);

/** use {@link Handle} */
export type HandleFn<
	T extends Record<string, QueryVar<any>> = Record<string, QueryVar<any>>,
> = (csr: CrelteServerRequest, vars: InferVariableTypes<T>) => any;

/**
 * #### Example
 * ```ts
 * // queries/custom.ts
 * import { vars, type Handle, gql, namedQuery } from 'crelte/queries';
 *
 * // It is good practice to have the query name inside the file
 * export const customQuery = namedQuery('custom');
 *
 * export const variables = {
 *     name: vars.string(),
 * };
 *
 * export const handle: Handle<typeof variables> = async (csr, vars) => {
 *     if (vars.name === 'demo') {
 *         throw new Response('not allowed', { status: 400 });
 *     }
 *
 *     return { name: vars.name };
 * };
 * ```
 */
export type Handle<
	T extends Record<string, QueryVar<any>> = Record<string, QueryVar<any>>,
	F extends HandleFn<T> = HandleFn<T>,
> = (
	csr: CrelteServerRequest,
	vars: InferVariableTypes<T>,
) => Awaited<ReturnType<F>>;
