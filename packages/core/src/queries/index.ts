import Queries, {
	isQuery,
	QueriesOptions,
	Query,
	QueryOptions,
} from '../queries/Queries.js';
import { gql } from './gql.js';
import QueryError from './QueryError.js';
import { isQueryVar, QueryVar, ValidIf, vars } from './vars.js';

export {
	Queries,
	type QueriesOptions,
	type QueryOptions,
	type Query,
	isQuery,
	QueryError,
	gql,
	vars,
	type ValidIf,
	QueryVar,
	isQueryVar,
};
