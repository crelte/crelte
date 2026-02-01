import CrelteServerRequest from '../CrelteServer.js';
import QueriesCaching from './QueriesCaching.js';
import { QueryVar, vars } from '../../queries/vars.js';
import { extractEntry } from '../../loadData/index.js';
import ServerRouter from '../ServerRouter.js';
import { calcKey } from '../../ssr/index.js';

export type CacheIfFn = (response: any, vars: Record<string, any>) => boolean;

/// Anything other than returning undefined will replace the response
//
// Note that even if you return undefined since the response is by reference
// you're modifications will be reflected
export type TransformFn = (
	response: any,
	vars: Record<string, any>,
) => void | any | Promise<void | any>;

export type QueryRouteArgs = {
	vars: Record<string, QueryVar> | null;
	cacheIfFn: CacheIfFn | null;
	preventCaching: boolean;
	transformFn: TransformFn | null;
};

// only internal
export class QueryRoute {
	name: string;
	query: string;
	vars: Record<string, QueryVar> | null;
	cacheIfFn: CacheIfFn | null;
	transformFn: TransformFn | null;

	constructor(name: string, query: string, args: QueryRouteArgs) {
		if (args.cacheIfFn && !vars)
			throw new Error(
				'queryRoute: ' +
					name +
					' cannot have caching function if there are no ' +
					'variables defined',
			);

		this.name = name;
		this.query = query;
		this.vars = args.vars;
		this.cacheIfFn = args.cacheIfFn;
		this.transformFn = args.transformFn;

		if (args.preventCaching) {
			if (this.cacheIfFn) throw new Error('unreachable');
			// prevent filling defaults
			return;
		}

		// add default vars and cacheIfFn if we know the route
		if (this.name === 'entry') this.fillEntryDefaults();
		else if (this.name === 'global') this.fillGlobalDefaults();
		else this.fillBasicDefaults();
	}

	private fillEntryDefaults() {
		if (this.vars) return;

		// the _setName step happens in parseVars which happens before setting
		// the defaults, so since we're adding vars here we need to set the name
		// manually
		this.vars = {
			siteId: vars.siteId().z_setName('siteId'),
			uri: vars.string().z_setName('uri'),
		};
		this.cacheIfFn = res => !!extractEntry(res);
	}

	private fillGlobalDefaults() {
		if (this.vars) return;

		this.vars = { siteId: vars.siteId().z_setName('siteId') };
		this.cacheIfFn = () => true;
	}

	/**
	 * This adds caching to queries containing `query {` or
	 * `query ($siteId: [QueryArgument) {` without any additional vars
	 */
	private fillBasicDefaults() {
		if (this.vars) return;

		const NO_VAR_TEST = /(^|\s)query\s*{/;
		const SITE_ID_VAR_TEST =
			/(^|\s)query\s*\(\s*\$siteId\s*:\s*\[\s*QueryArgument\s*\]\s*\)\s*{/;

		if (NO_VAR_TEST.test(this.query)) {
			this.vars = {};
			this.cacheIfFn = () => true;
		} else if (SITE_ID_VAR_TEST.test(this.query)) {
			this.vars = { siteId: vars.siteId().z_setName('siteId') };
			this.cacheIfFn = () => true;
		} else if (!this.query.includes('query')) {
			// this warning might be shown to mutation queries or subscriptions
			// in that case, the user should explicitly set caching to false
			console.warn(
				`cannot determine if query (${this.name}) is cacheable, see` +
					' https://github.com/crelte/crelte/issues/114 for infos',
			);
		}
	}

	/**
	 * Returns the validated variables if some vars where defined
	 * else just returns all vars
	 */
	validateVars(vars: any, cs: ServerRouter): Record<string, any> {
		if (!vars || typeof vars !== 'object')
			throw new Error('expected an object as vars');

		if (!this.vars) return vars;

		const nVars: Record<string, any> = {};

		for (const [k, v] of Object.entries(this.vars)) {
			nVars[k] = v.validValue(vars[k], cs);
		}

		return nVars;
	}

	private async transform(
		jsonResp: Record<string, any>,
		vars: Record<string, any>,
	): Promise<void> {
		if (!this.transformFn || !jsonResp.data) return;

		const transformed = await this.transformFn(jsonResp.data, vars);
		if (typeof transformed !== 'undefined') jsonResp.data = transformed;
	}

	async handle(
		caching: QueriesCaching,
		csr: CrelteServerRequest,
	): Promise<Response> {
		let vars;
		try {
			const reqVars = await csr.req.json();
			vars = this.validateVars(reqVars, caching.router);
			if ('qName' in vars || 'xCraftSite' in vars)
				throw new Error(
					'qName and xCraftSite are reserved variable names',
				);
		} catch (e) {
			return newError(e, 400);
		}

		let logInfo: string | null = null;
		if (caching.debug) {
			logInfo = `[queries: ${this.name}] vars: ${JSON.stringify(vars)}`;
		}

		let previewToken: string | null = null;
		let siteToken: string | null = null;

		const reqSearch = new URL(csr.req.url).searchParams;

		if (reqSearch.has('token')) {
			previewToken = reqSearch.get('token');
		} else if (reqSearch.has('siteToken')) {
			siteToken = reqSearch.get('siteToken');
		}

		// check for x-craft-site header and pass it on
		const xCraftSite = csr.req.headers.get('X-Craft-Site');

		let cacheKey: string | null = null;
		const useCache = !previewToken && caching.isEnabled();
		if (useCache) {
			cacheKey = await calcKey({ ...vars, qName: this.name, xCraftSite });
			const cached = await caching.getCache(cacheKey);

			if (logInfo) console.log(`${logInfo} ${cached ? 'hit' : 'miss'}`);

			// we found something in the cache
			if (cached) return Response.json(cached);
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};

		const auth = csr.getEnv('ENDPOINT_TOKEN');
		if (auth) headers['Authorization'] = 'Bearer ' + auth;

		const url = new URL(csr.getEnv('ENDPOINT_URL'));
		if (previewToken) url.searchParams.set('token', previewToken);
		if (siteToken) url.searchParams.set('siteToken', siteToken);

		const xDebug = csr.req.headers.get('X-Debug');
		if (xDebug) headers['X-Debug'] = xDebug;

		if (xCraftSite) headers['X-Craft-Site'] = xCraftSite;

		// now execute the gql request
		let resp: Response;
		try {
			resp = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					query: this.query,
					variables: vars,
				}),
			});

			// if the response is not ok we don't cache anything
			// and just return the response
			if (!resp.ok) return resp;
		} catch (e) {
			return newError(e, 500);
		}

		const respHeaders: Record<string, string> = {};
		const xDebugLink = resp.headers.get('X-Debug-Link');
		if (xDebugLink) respHeaders['X-Debug'] = xDebugLink;

		let jsonResp: Record<string, any>;
		try {
			jsonResp = await resp.json();
			if (!jsonResp || typeof jsonResp !== 'object')
				throw new Error('invalid json response');
			await this.transform(jsonResp, vars);
		} catch (e) {
			return newError(e, 500);
		}

		// also no caching for errors
		if (jsonResp.errors) {
			return Response.json(jsonResp, { headers: respHeaders });
		}

		// now we have a valid json resp.
		// should we cache it?
		if (cacheKey && this.cacheIfFn?.(jsonResp.data, vars)) {
			try {
				await caching.setCache(cacheKey, jsonResp);
				if (logInfo) console.log(logInfo + ' set cache');
			} catch (e) {
				console.error('could not cache gql response', e);
			}
			// if caching is enabled but not used we warn
		} else if (cacheKey && logInfo) {
			console.warn('!! ' + logInfo + ' caching not allowed');
		}

		return Response.json(jsonResp, { headers: respHeaders });
	}
}

export function newError(e: any, status: number): Response {
	return new Response((e as Error).message, { status });
}
