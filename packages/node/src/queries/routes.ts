import { calcKey } from 'crelte/ssr';
import CrelteServerRequest from '../CrelteServer.js';
import Router from '../Router.js';
import QueriesCaching from './QueriesCaching.js';
import { QueryVar, vars } from './vars.js';
import { extractEntry } from 'crelte/entry';

export type CacheIfFn = (response: any, vars: Record<string, any>) => boolean;

// only internal
export class QueryRoute {
	name: string;
	query: string;
	vars: Record<string, QueryVar> | null;
	cacheIfFn: CacheIfFn | null;

	constructor(
		name: string,
		query: string,
		vars: Record<string, QueryVar> | null,
		cacheIfFn: CacheIfFn | null,
	) {
		if (cacheIfFn && !vars)
			throw new Error(
				'queryRoute: ' +
					name +
					' cannot have cacheIfFn if there are no vars defined',
			);

		this.name = name;
		this.query = query;
		this.vars = vars;
		this.cacheIfFn = cacheIfFn;

		// add default vars and cacheIfFn if we know the route
		if (this.name === 'entry') this.fillEntryDefaults();
		else if (this.name === 'global') this.fillGlobalDefaults();
		else this.fillBasicDefaults();
	}

	private fillEntryDefaults() {
		if (this.vars) return;

		// the _setName step happens in parseVars which happens before setting
		// the defaults
		this.vars = {
			siteId: vars.siteId()._setName('siteId'),
			uri: vars.string()._setName('uri'),
		};
		this.cacheIfFn = res => !!extractEntry(res);
	}

	private fillGlobalDefaults() {
		if (this.vars) return;

		this.vars = { siteId: vars.siteId()._setName('siteId') };
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
			this.vars = { siteId: vars.siteId()._setName('siteId') };
			this.cacheIfFn = () => true;
		}
	}

	/**
	 * Returns the validated variables if some vars where defined
	 * else just returns all vars
	 */
	validateVars(vars: any, cs: Router): Record<string, any> {
		if (!vars || typeof vars !== 'object')
			throw new Error('expected an object as vars');

		if (!this.vars) return vars;

		const nVars: Record<string, any> = {};

		for (const [k, v] of Object.entries(this.vars)) {
			nVars[k] = v.validValue(vars[k], cs);
		}

		return nVars;
	}

	async handle(
		caching: QueriesCaching,
		csr: CrelteServerRequest,
	): Promise<Response> {
		let vars;
		try {
			const reqVars = await csr.req.json();
			vars = this.validateVars(reqVars, caching.router);
		} catch (e) {
			return newError(e, 400);
		}

		let previewToken: string | null = null;
		let siteToken: string | null = null;

		const reqSearch = new URL(csr.req.url).searchParams;

		if (reqSearch.has('token')) {
			previewToken = reqSearch.get('token');
		} else if (reqSearch.has('siteToken')) {
			siteToken = reqSearch.get('siteToken');
		}

		let cacheKey: string | null = null;
		const useCache = !previewToken;
		if (useCache) {
			cacheKey = await calcKey({ name: this.name, ...vars });
			const cached = await caching.getCache(cacheKey);

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
		const xDebugLink = resp.headers.get('x-debug-link');
		if (xDebugLink) respHeaders['X-Debug'] = xDebugLink;

		let jsonResp: Record<string, any>;
		try {
			jsonResp = await resp.json();
			if (!jsonResp || typeof jsonResp !== 'object')
				throw new Error('invalid json response');
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
			} catch (e) {
				console.error('could not cache gql response', e);
			}
		}

		return Response.json(jsonResp, { headers: respHeaders });
	}
}

export function newError(e: any, status: number): Response {
	return new Response((e as Error).message, { status });
}
