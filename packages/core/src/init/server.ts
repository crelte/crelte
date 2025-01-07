import { CrelteBuilder } from '../Crelte.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import { loadFn, pluginsBeforeRender, setupPlugins } from './shared.js';
import SsrComponents from '../ssr/SsrComponents.js';
import SsrCache from '../ssr/SsrCache.js';
import ServerCookies from '../cookies/ServerCookies.js';

export type ServerData = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string[]>;
	acceptLang?: string;
	endpoint: string;
	craftWeb: string;
	viteEnv: Map<string, string>;
	cookies?: string;
};

export type MainData = {
	/// svelte app component
	app: any;
	entryQuery: any;
	globalQuery?: any;

	serverData: ServerData;

	// debug
	graphQlDebug?: boolean;
	debugTiming?: boolean;
};

export async function main(data: MainData): Promise<{
	status: number;
	location?: string;
	html?: string;
	setCookies?: string[];
}> {
	const builder = new CrelteBuilder();

	// setup viteEnv
	data.serverData.viteEnv.forEach((v, k) => {
		builder.ssrCache.set(k, v);
	});

	const endpoint = data.serverData.endpoint;
	builder.ssrCache.set('ENDPOINT_URL', endpoint);
	builder.ssrCache.set('CRAFT_WEB_URL', data.serverData.craftWeb);
	builder.setupGraphQl(endpoint, {
		debug: data.graphQlDebug,
		debugTiming: data.debugTiming,
	});

	const cookies = data.serverData.cookies ?? '';
	builder.setupCookies(cookies);

	const csites = await loadSites(builder);
	builder.ssrCache.set('crelteSites', csites);
	builder.setupRouter(csites);

	const crelte = builder.build();

	// setup plugins
	setupPlugins(crelte, data.app.plugins ?? []);

	// setup load Data

	crelte.router._internal.onLoad = (route, site) => {
		const cr = crelte.toRouted(route, site);
		return loadFn(cr, data.app, data.entryQuery, data.globalQuery);
	};

	const { success, redirect, route, site, props } =
		await crelte.router._internal.initServer(
			data.serverData.url,
			data.serverData.acceptLang,
		);
	if (!success) throw props;

	if (redirect) {
		return {
			status: 302,
			location: route.url.toString(),
		};
	}

	const context = crelte._getContext();
	const ssrComponents = new SsrComponents();
	ssrComponents.addToContext(context);

	pluginsBeforeRender(crelte.toRouted(route, site));
	crelte.globals._updateSiteId(site.id);
	// eslint-disable-next-line prefer-const
	let { html, head } = data.app.default.render(props, { context });

	head += ssrComponents.toHead(data.serverData.ssrManifest);
	head += crelte.ssrCache._exportToHead();

	let htmlTemplate = data.serverData.htmlTemplate;
	htmlTemplate = htmlTemplate.replace('<!--page-lang-->', site.language);

	const finalHtml = htmlTemplate
		.replace('<!--ssr-head-->', head)
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
async function loadSites(builder: CrelteBuilder): Promise<SiteFromGraphQl[]> {
	if (!builder.graphQl) throw new Error();

	if ('CRAFT_SITES_CACHED' in globalThis) {
		// @ts-ignore
		return globalThis['CRAFT_SITES_CACHED'];
	}

	const resp = (await builder.graphQl.request(
		'query { crelteSites { id baseUrl language name handle primary } }',
		{},
		// don't cache since we cache ourself
		{ caching: false },
	)) as { crelteSites: SiteFromGraphQl[] };

	// @ts-ignore
	globalThis['CRAFT_SITES_CACHED'] = resp.crelteSites;
	return resp.crelteSites;
}
