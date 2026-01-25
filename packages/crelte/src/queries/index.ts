import Queries, {
	isQuery,
	QueriesOptions,
	Query,
	QueryOptions,
} from '../queries/Queries.js';
import { gql } from './gql.js';
import QueryError, { QueryErrorResponse } from './QueryError.js';
import { QueryVar, ValidIf, vars, varsIdsEqual } from './vars.js';

export {
	Queries,
	type QueriesOptions,
	type QueryOptions,
	type Query,
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
