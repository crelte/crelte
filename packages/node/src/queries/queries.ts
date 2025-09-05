import Router from '../Router.js';
import QueriesCaching from './QueriesCaching.js';
import { CacheIfFn, QueryRoute } from './routes.js';
import { isQueryVar, QueryVar } from './vars.js';

type ModQuery = {
	default: { name: string };
	query: { path: string; query: string };
};

type ModTs = {
	variables: any;
	caching?: any;
};

type ModQueries = Record<string, ModQuery | ModTs>;

type PreRoute = {
	query: string | null;
	jsFile: string | null;
	vars: Record<string, QueryVar> | null;
	cacheIfFn: CacheIfFn | null;
};

export async function initQueryRoutes(mod: any, router: Router): Promise<void> {
	if (typeof mod.queries !== 'object') {
		throw new Error(
			"expected `export const queries = import.meta.glob('@/queries/*', { eager: true });` in server.js",
		);
	}

	const modQueries: ModQueries = mod.queries;

	const preRoutes: Map<string, PreRoute> = new Map();

	for (const [file, mq] of Object.entries(modQueries)) {
		const filename = file.split('/').pop()!;
		const dotPos = filename.lastIndexOf('.');
		const name = filename.substring(0, dotPos);

		let preRoute = preRoutes.get(name);
		if (!preRoute) {
			preRoute = {
				query: null,
				jsFile: null,
				vars: null,
				cacheIfFn: null,
			};
			preRoutes.set(name, preRoute);
		}

		// set the gql query (this can only happen once)
		if (filename.endsWith('.graphql')) {
			preRoute.query = (mq as ModQuery).query.query;
			continue;
		}

		// now check that only one file matches
		if (preRoute.jsFile) {
			throw new Error(
				`cannot have two files for the same query ${preRoute.jsFile} and ${filename}`,
			);
		}

		const mts = mq as ModTs;
		if (mts.variables) {
			preRoute.vars = parseVars(mts.variables);
		}

		if (mts.caching) {
			preRoute.cacheIfFn = parseCaching(mts.caching);
		}
	}

	const caching = new QueriesCaching(router);

	for (const [name, pr] of preRoutes.entries()) {
		if (!pr.query) throw new Error(`no .graphql file for query ${name}`);

		const route = new QueryRoute(name, pr.query, pr.vars, pr.cacheIfFn);

		router.post('/queries/' + route.name, async csr =>
			route.handle(caching, csr),
		);
	}
}

function parseVars(vars: any): Record<string, QueryVar> {
	if (!vars) return {};

	if (typeof vars !== 'object')
		throw new Error('expected an object for vars');

	for (const [name, v] of Object.entries(vars)) {
		if (!isQueryVar(v))
			throw new Error(
				'expected all values in vars to be QueryVar (' + name + ')',
			);

		v._setName(name);
	}

	return vars;
}

function parseCaching(caching: any): CacheIfFn {
	if (typeof caching === 'boolean') return () => caching;

	if (typeof caching !== 'function')
		throw new Error('caching should be a function or a boolean');

	return caching;
}
