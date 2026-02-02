import ServerRouter from '../ServerRouter.js';
import QueriesCaching from './QueriesCaching.js';
import { CacheIfFn, HandleFn, TransformFn } from './routes.js';
import { isQueryVar, QueryVar } from '../../queries/vars.js';
import { Platform } from '../platform.js';
import QueryHandleRoute from './QueryHandleRoute.js';
import QueryGqlRoute from './QueryGqlRoute.js';

type ModQuery = {
	default: { name: string };
	query: { path: string; query: string };
};

type ModTs = {
	variables?: any;
	caching?: any;
	transform?: any;
	handle?: any;
};

type ModQueries = Record<string, ModQuery | ModTs>;

type RouteBuilder = {
	query: string | null;
	jsFile: string | null;
	vars: Record<string, QueryVar> | null;
	/** corresponds to the caching export */
	cacheIfFn: CacheIfFn | null;
	preventCaching: boolean;
	transformFn: TransformFn | null;
	handleFn: HandleFn | null;
};

export async function initQueryRoutes(
	platform: Platform,
	mod: any,
	router: ServerRouter,
): Promise<void> {
	if (typeof mod.queries !== 'object') {
		throw new Error(
			'expected `export const queries = import.meta.glob(' +
				"'@/queries/*', { eager: true });` in server.js",
		);
	}

	const debugCaching = !!mod?.debugCaching;
	const modQueries: ModQueries = mod.queries;

	const routeBuilders: Map<string, RouteBuilder> = new Map();

	for (const [file, mq] of Object.entries(modQueries)) {
		const filename = file.split('/').pop()!;
		const dotPos = filename.lastIndexOf('.');
		const name = filename.substring(0, dotPos);

		let routeBuilder = routeBuilders.get(name);
		if (!routeBuilder) {
			routeBuilder = {
				query: null,
				jsFile: null,
				vars: null,
				cacheIfFn: null,
				preventCaching: false,
				transformFn: null,
				handleFn: null,
			};
			routeBuilders.set(name, routeBuilder);
		}

		// set the gql query (this can only happen once)
		if (filename.endsWith('.graphql')) {
			routeBuilder.query = (mq as ModQuery).query.query;
			continue;
		}

		// now check that only one file matches
		if (routeBuilder.jsFile) {
			throw new Error(
				`cannot have two files for the same query ${
					routeBuilder.jsFile
				} and ${filename}`,
			);
		}

		const mts = mq as ModTs;
		if (mts.variables) {
			routeBuilder.vars = parseVars(mts.variables);
		}

		if (mts.caching) {
			routeBuilder.cacheIfFn = parseCaching(mts.caching);
		} else if (typeof mts.caching === 'boolean') {
			routeBuilder.preventCaching = true;
		}

		if (mts.transform) {
			routeBuilder.transformFn = parseTransform(mts.transform);
		}

		if (mts.handle) {
			routeBuilder.handleFn = parseHandle(mts.handle);
		}
	}

	const caching = new QueriesCaching(platform, router, {
		debug: debugCaching,
	});

	for (const [name, rb] of routeBuilders.entries()) {
		if (rb.query) {
			if (rb.handleFn) throw new Error('handle function not supported');

			const route = new QueryGqlRoute(name, rb.query, rb);

			router.post('/queries/' + route.name, csr =>
				route.handle(caching, csr),
			);
		} else if (rb.handleFn) {
			if (rb.cacheIfFn || rb.transformFn || rb.preventCaching)
				throw new Error('caching or transform not supported');

			const route = new QueryHandleRoute(name, rb.handleFn, rb.vars);

			router.post('/queries/' + route.name, csr =>
				route.handle(caching.router, csr),
			);
		} else {
			throw new Error(
				`query js/ts ${name} file needs to either have ` +
					'a .graphql file or a handle function',
			);
		}
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

		v.z_setName(name);
	}

	return vars;
}

function parseCaching(caching: any): CacheIfFn {
	if (typeof caching === 'boolean') return () => caching;

	if (typeof caching !== 'function')
		throw new Error('caching should be a function or a boolean');

	return caching;
}

function parseTransform(transform: any): TransformFn {
	if (typeof transform !== 'function')
		throw new Error('transform should be a function');

	return transform;
}

function parseHandle(handle: any): HandleFn {
	if (typeof handle !== 'function')
		throw new Error('handle should be a function');

	return handle;
}
