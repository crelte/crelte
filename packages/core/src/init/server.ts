import { CrelteBuilder } from '../Crelte.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import { pluginsBeforeRender, prepareLoadFn, setupPlugins } from './shared.js';
import SsrComponents from '../ssr/SsrComponents.js';
import SsrCache from '../ssr/SsrCache.js';
import ServerCookies from '../cookies/ServerCookies.js';
import CrelteRequest from '../CrelteRequest.js';
import { gql, GraphQlQuery } from '../graphql/GraphQl.js';

export type ServerData = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string[]>;
	acceptLang?: string;
	endpoint: string;
	craftWeb: string;
	viteEnv: Map<string, string>;
	cookies?: string;
	readSitesCache?: () => Promise<any>;
	writeSitesCache?: (data: any) => Promise<void>;
};

/**
 * The main function to start the server side rendering
 */
export type MainData = {
	/** The App.svelte module */
	app: any;
	/** The entry query from queries/entry.graphql */
	entryQuery: GraphQlQuery;
	/** The global query from queries/global.graphql */
	globalQuery?: GraphQlQuery;

	/** Server data provided by crelte-node */
	serverData: ServerData;
};

/**
 * The main function to start the server side rendering
 *
 * ## Example
 * ```
 * import * as app from './App.svelte';
 * import entryQuery from './queries/entry.graphql';
 * import globalQuery from './queries/global.graphql';
 * import { main } from 'crelte/server';
 *
 * export function render(serverData) {
 *     return main({
 *         app,
 *         entryQuery,
 *         globalQuery,
 *         serverData,
 *     });
 * }
 * ```
 */
export async function main(data: MainData): Promise<{
	status: number;
	location?: string;
	html?: string;
	setCookies?: string[];
}> {
	const builder = new CrelteBuilder(data.app.config ?? {});

	// setup viteEnv
	data.serverData.viteEnv.forEach((v, k) => {
		builder.ssrCache.set(k, v);
	});

	const endpoint = data.serverData.endpoint;
	builder.ssrCache.set('ENDPOINT_URL', endpoint);
	builder.ssrCache.set('CRAFT_WEB_URL', data.serverData.craftWeb);
	builder.setupGraphQl(endpoint);

	const cookies = data.serverData.cookies ?? '';
	builder.setupCookies(cookies);

	const csites = await loadSites(builder, data.serverData);
	builder.ssrCache.set('crelteSites', csites);
	builder.setupRouter(csites);

	const crelte = builder.build();

	// setup plugins
	setupPlugins(crelte, data.app.plugins ?? []);

	const loadFn = await prepareLoadFn(
		crelte,
		data.app,
		data.entryQuery,
		data.globalQuery,
	);

	// setup load Data

	crelte.router._internal.onLoad = req => {
		const cr = new CrelteRequest(crelte, req);
		return loadFn(cr);
	};

	const { success, redirect, req, props } =
		await crelte.router._internal.initServer(
			data.serverData.url,
			data.serverData.acceptLang,
		);
	if (!success) throw props;

	if (redirect) {
		return {
			status: req.statusCode ?? 302,
			location: req.url.toString(),
		};
	}

	const context = crelte._getContext();
	const ssrComponents = new SsrComponents();
	ssrComponents.addToContext(context);

	const cr = new CrelteRequest(crelte, req);
	pluginsBeforeRender(cr);
	crelte.globals._updateSiteId(cr.site.id);
	// eslint-disable-next-line prefer-const
	let { html, head } = data.app.default.render(props, { context });

	head += ssrComponents.toHead(data.serverData.ssrManifest);
	head += crelte.ssrCache._exportToHead();

	let htmlTemplate = data.serverData.htmlTemplate;
	htmlTemplate = htmlTemplate.replace('<!--page-lang-->', cr.site.language);

	const finalHtml = htmlTemplate
		.replace('</head>', head + '\n\t</head>')
		.replace('<!--ssr-body-->', html);

	const entry = props.entry;

	return {
		status:
			entry.sectionHandle === 'error' ? parseInt(entry.typeHandle) : 200,
		html: finalHtml,
		setCookies: (crelte.cookies as ServerCookies)._getSetCookiesHeaders(),
	};
}

export type Error = {
	status: number;
	message: any;
};

export type MainErrorData = {
	/// svelte app component
	error: Error;
	errorPage: any;

	serverData: ServerData;
};

/**
 * The main function to start the server side rendering
 * if there was an error
 *
 * ## Example
 * ```
 * import * as errorPage from './Error.svelte';
 *
 * export function renderError(error, serverData) {
 *     return mainError({
 *         error,
 *         errorPage,
 *         serverData
 *     });
 * }
 * ```
 */
export async function mainError(
	data: MainErrorData,
): Promise<{ status: number; html?: string }> {
	const ssrCache = new SsrCache();

	const context = new Map();
	const ssrComponents = new SsrComponents();
	ssrComponents.addToContext(context);

	ssrCache.set('ERROR', data.error);

	// eslint-disable-next-line prefer-const
	let { html, head } = data.errorPage.default.render(data.error, { context });

	head += ssrComponents.toHead(data.serverData.ssrManifest);
	head += ssrCache._exportToHead();

	let htmlTemplate = data.serverData.htmlTemplate;
	htmlTemplate = htmlTemplate.replace('<!--page-lang-->', 'de');

	const finalHtml = htmlTemplate
		.replace('<!--ssr-head-->', head)
		.replace('<!--ssr-body-->', html);

	return {
		status: data.error.status,
		html: finalHtml,
	};
}

// requires, GraphQl, SsrCache
async function loadSites(
	builder: CrelteBuilder,
	serverData: ServerData,
): Promise<SiteFromGraphQl[]> {
	if (!builder.graphQl) throw new Error();

	if ('CRAFT_SITES_CACHED' in globalThis) {
		return (globalThis as any)['CRAFT_SITES_CACHED'];
	}

	if (import.meta.env.PROD && serverData.readSitesCache) {
		try {
			const sites =
				(await serverData.readSitesCache()) as SiteFromGraphQl[];
			// @ts-ignore
			globalThis['CRAFT_SITES_CACHED'] = sites;
			return sites;
		} catch (_e: any) {
			// ignore
		}
	}

	const resp = (await builder.graphQl.query(
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
		{ caching: false },
	)) as { crelteSites: SiteFromGraphQl[] };

	// @ts-ignore
	globalThis['CRAFT_SITES_CACHED'] = resp.crelteSites;
	if (import.meta.env.PROD && serverData.writeSitesCache) {
		await serverData.writeSitesCache(resp.crelteSites);
	}
	return resp.crelteSites;
}
