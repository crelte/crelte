import Queries from '../queries/Queries.js';
import { SsrCache } from '../ssr/index.js';
import { gql } from '../queries/index.js';
import { Platform } from './platform.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import { isQueryError } from '../queries/QueryError.js';

export type ServerOptions = {
	// typescript client.ts & server.ts
	ts?: boolean;
};

export type RenderResponse = {
	status: number;
	location?: string;
	html?: string;
	headers: Headers;
};

/*
steps debug:
setup vite
setup route
*/

export type EnvData = {
	env: Map<string, string>;
	endpointUrl: string;
	endpointToken?: string;
	craftBaseCpUrl: string;
	frontendUrl: string;
	viteEnv: Map<string, string>;
};

export async function initEnvData(os: Platform): Promise<EnvData> {
	const envPath = '../craft/.env';

	let env;
	try {
		env = readEnv(await os.readFile(envPath));
	} catch (_e) {
		throw new Error('failed to read ' + envPath + ' file');
	}

	const endpointUrl = env.get('ENDPOINT_URL');
	if (!endpointUrl) throw new Error('ENDPOINT_URL not set');

	const endpointToken = env.get('ENDPOINT_TOKEN');

	const craftBaseCpUrl = env.get('CRAFT_BASE_CP_URL');
	if (!craftBaseCpUrl) throw new Error('CRAFT_BASE_CP_URL not set');

	const frontendUrl = env.get('FRONTEND_URL');
	if (!frontendUrl) throw new Error('FRONTEND_URL not set');

	// parse all vite related env variables
	const viteEnv = new Map(
		Array.from(env).filter(([key]) => key.startsWith('VITE_')),
	);

	return {
		env,
		endpointUrl,
		endpointToken,
		craftBaseCpUrl,
		frontendUrl,
		viteEnv,
	};
}

export type SitesCache = {
	enabled: boolean;
	readSitesCache?: () => Promise<any>;
	writeSitesCache?: (data: any) => Promise<void>;
};

export async function initSites(
	env: EnvData,
	cache?: SitesCache,
	siteToken?: string,
): Promise<SiteFromGraphQl[]> {
	const queries = Queries.new(
		env.endpointUrl,
		env.frontendUrl,
		new SsrCache(),
		{ bearerToken: env.endpointToken },
	);
	return await loadSites(queries, cache, siteToken);
}

export async function initRequestSites(
	env: EnvData,
	sites: SiteFromGraphQl[],
	req: Request,
): Promise<SiteFromGraphQl[]> {
	const siteToken = new URL(req.url).searchParams.get('siteToken');
	if (!siteToken) return sites;

	// Preview sites belong to this request, not the shared site cache.
	return await initSites(env, undefined, siteToken);
}

// requires, GraphQl, SsrCache
async function loadSites(
	queries: Queries,
	cache?: SitesCache,
	siteToken?: string,
): Promise<SiteFromGraphQl[]> {
	const useCache = !siteToken;

	if (useCache && 'CRAFT_SITES_CACHED' in globalThis) {
		return (globalThis as any)['CRAFT_SITES_CACHED'];
	}

	if (useCache && cache?.enabled && cache?.readSitesCache) {
		try {
			const sites = (await cache.readSitesCache()) as SiteFromGraphQl[];
			// @ts-ignore
			globalThis['CRAFT_SITES_CACHED'] = sites;
			return sites;
		} catch (_e: any) {
			// ignore
		}
	}

	const resp = (await queries.query(
		gql`
			query {
				crelteSites {
					id
					baseUrl
					language
					name
					handle
					primary
				}
			}
		`,
		{},
		// don't cache since we cache ourself
		{ caching: false, craftCaching: useCache, siteToken },
	)) as { crelteSites: SiteFromGraphQl[] };

	if (useCache) {
		// @ts-ignore
		globalThis['CRAFT_SITES_CACHED'] = resp.crelteSites;
		if (cache?.enabled && cache?.writeSitesCache) {
			await cache.writeSitesCache(resp.crelteSites);
		}
	}
	return resp.crelteSites;
}

export type ModRenderOptions = {
	ssrManifest?: Record<string, string[]>;
};

type RenderFn = (req: RenderRequest) => Promise<RenderResponse>;

// todo better typing
export type RenderRequest = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string[]>;
	endpoint: string;
	craftUrl: string;
	frontend: string;
	viteEnv: Map<string, string>;
	sites: SiteFromGraphQl[];
	headers: Headers;
};

export async function modRender(
	env: EnvData,
	sites: SiteFromGraphQl[],
	mod: any,
	template: string,
	req: Request,
	opts: ModRenderOptions = {},
): Promise<Response> {
	const {
		status,
		location,
		html,
		headers: nHeaders,
	} = await (mod.render as RenderFn)({
		url: req.url,
		htmlTemplate: template,
		ssrManifest: {},
		endpoint: env.endpointUrl,
		craftUrl: env.craftBaseCpUrl,
		frontend: env.frontendUrl,
		viteEnv: env.viteEnv,
		sites,
		headers: req.headers,
		...opts,
	});

	if (status === 301 || status === 302) {
		nHeaders.append('Location', location ?? '');
		return new Response(null, { status, headers: nHeaders });
	}

	nHeaders.append('Content-Type', 'text/html');
	return new Response(html, { status, headers: nHeaders });
}

type RenderErrorFn = (
	error: { status: number; message: string },
	req: RenderErrorRequest,
) => Promise<RenderResponse>;

// todo better typing
export type RenderErrorRequest = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string[]>;
	acceptLang: string | null;
	endpoint: string;
	craftUrl: string;
	frontend: string;
	viteEnv: Map<string, string>;
};

export async function modRenderError(
	env: EnvData,
	mod: any,
	thrownError: Error,
	template: string,
	req: Request,
	opts: ModRenderOptions & { debugError?: boolean } = {},
): Promise<Response> {
	const acceptLang = req.headers.get('Accept-Language') ?? null;

	// in the case of an error let's try to render a nice Error Page
	const error = {
		status: 500,
		message: thrownError.message,
	};

	if (isQueryError(thrownError)) {
		error.status = thrownError.status();
	}

	// todo is the process.env.NODE_ENV the correct check?
	if (
		error.status !== 503 &&
		!opts.debugError &&
		process.env.NODE_ENV === 'development'
	) {
		throw thrownError;
	}

	const { status, html } = await (mod.renderError as RenderErrorFn)(error, {
		url: req.url,
		htmlTemplate: template,
		ssrManifest: {},
		acceptLang,
		endpoint: env.endpointUrl,
		craftUrl: env.craftBaseCpUrl,
		frontend: env.frontendUrl,
		viteEnv: env.viteEnv,
		...opts,
	});

	return new Response(html, {
		status,
		headers: { 'Content-Type': 'text/html' },
	});
}

/**
 * Parses an .env file
 *
 * @param fileCtn the file content.
 * @returns a Map of the env variables.
 */
function readEnv(fileCtn: string): Map<string, string> {
	// todo should we skip comments?
	const REGEX = /^ *(\w+) *= *"?(.+?)"? *$/gm;

	const map = new Map();
	// @ts-ignore
	for (const match of fileCtn.matchAll(REGEX)) {
		if (match.length === 3) map.set(match[1], match[2]);
	}

	return map;
}
