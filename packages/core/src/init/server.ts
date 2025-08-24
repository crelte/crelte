import { CrelteBuilder } from '../Crelte.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import {
	loadFn,
	pluginsBeforeRender,
	pluginsBeforeRequest,
	setupPlugins,
} from './shared.js';
import SsrComponents from '../ssr/SsrComponents.js';
import SsrCache from '../ssr/SsrCache.js';
import ServerCookies from '../cookies/ServerCookies.js';
import CrelteRequest from '../CrelteRequest.js';
import { svelteRender } from './svelteComponents.js';
import { Writable } from 'crelte-std/stores';
import ServerRouter from '../routing/ServerRouter.js';
import InternalApp from './InternalApp.js';

export type ServerData = {
	url: string;
	htmlTemplate: string;
	ssrManifest: Record<string, string[]>;
	acceptLang?: string;
	endpoint: string;
	craftWeb: string;
	viteEnv: Map<string, string>;
	cookies: string;
	sites: SiteFromGraphQl[];
};

/**
 * The main function to start the server side rendering
 */
export type MainData = {
	/** The App.svelte module */
	app: any;

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
	builder.setupCookies(new ServerCookies(cookies));

	builder.ssrCache.set('crelteSites', data.serverData.sites);
	const router = new ServerRouter(data.serverData.sites, {
		debugTiming: builder.config.debugTiming ?? false,
	});
	builder.setupRouter(router);

	const crelte = builder.build();

	const app = new InternalApp(data.app);

	// setup plugins
	setupPlugins(crelte, app.plugins);
	app.init(crelte);

	router.onNewCrelteRequest = req => {
		const cr = new CrelteRequest(crelte, req);
		cr._setRouter(cr.router._toRequest(req));
		cr._setGlobals(cr.globals._toRequest());
		return cr;
	};

	router.onBeforeRequest = pluginsBeforeRequest;

	router.loadRunner.loadFn = (cr, opts) => loadFn(cr, app, opts);

	router.onRender = (cr, readyForRoute, _domUpdated) => {
		const route = readyForRoute();
		cr.router._requestCompleted();
		cr.globals._syncToStores();
		pluginsBeforeRender(cr, route);

		return route;
	};

	// throws if there was an error
	const [req, route] = await router.init(
		data.serverData.url,
		data.serverData.acceptLang,
	);

	// if redirect
	if (!route) {
		return {
			status: req.statusCode ?? 302,
			location: req.url.toString(),
			setCookies: (
				crelte.cookies as ServerCookies
			)._getSetCookiesHeaders(),
		};
	}

	const context = crelte._getContext();
	const ssrComponents = new SsrComponents();
	ssrComponents.addToContext(context);

	// app should not use getRoute but use the route store
	// received from the props, since it will only update when
	// the entryChanges
	const routeProp = new Writable(route);

	// eslint-disable-next-line prefer-const
	let { html, head } = svelteRender(data.app.default, {
		props: { route: routeProp },
		context,
	});

	head += ssrComponents.toHead(data.serverData.ssrManifest);
	head += crelte.ssrCache._exportToHead();

	let htmlTemplate = data.serverData.htmlTemplate;
	htmlTemplate = htmlTemplate.replace(
		'<!--page-lang-->',
		route.site.language,
	);

	const finalHtml = htmlTemplate
		.replace('</head>', head + '\n\t</head>')
		.replace('<!--ssr-body-->', html);

	const entry = route.entry;

	return {
		status:
			req.statusCode ??
			(entry.sectionHandle === 'error'
				? parseInt(entry.typeHandle)
				: 200),
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

	// todo on the client crelte is in the context
	// but it should match this impl

	// eslint-disable-next-line prefer-const
	let { html, head } = svelteRender(data.errorPage.default, {
		props: data.error,
		context,
	});

	head += ssrComponents.toHead(data.serverData.ssrManifest);
	head += ssrCache._exportToHead();

	let htmlTemplate = data.serverData.htmlTemplate;
	htmlTemplate = htmlTemplate.replace('<!--page-lang-->', 'de');

	const finalHtml = htmlTemplate
		.replace('</head>', head + '\n\t</head>')
		.replace('<!--ssr-body-->', html);

	return {
		status: data.error.status,
		html: finalHtml,
	};
}
