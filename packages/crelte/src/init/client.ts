import { SiteFromGraphQl } from '../routing/Site.js';
import {
	loadFn,
	newQueries,
	onNewCrelteRequest,
	pluginsBeforeRender,
	pluginsBeforeRequest,
	setupPlugins,
} from './shared.js';
import { tick } from 'svelte';
import { svelteMount } from './svelteComponents.js';
import ClientCookies from '../cookies/ClientCookies.js';
import ClientRouter from '../routing/router/ClientRouter.js';
import InternalApp from './InternalApp.js';
import { Route, Router } from '../routing/index.js';
import { configWithDefaults, newCrelte } from '../crelte.js';
import SsrCache from '../ssr/SsrCache.js';
import Plugins from '../plugins/Plugins.js';
import Events from '../plugins/Events.js';
import Globals from '../loadData/Globals.js';
import { Writable } from '../std/stores/index.js';

/**
 * The main function to start the client side rendering
 */
export type MainData = {
	/** The App.svelte module */
	app: any;
	/** The Error.svelte module */
	errorPage: any;
};

/**
 * The main function to start the client side rendering
 *
 * ## Example
 * ```
 * import * as app from './App.svelte';
 * import * as errorPage from './Error.svelte';
 * import entryQuery from './queries/entry.graphql';
 * import globalQuery from './queries/global.graphql';
 * import { main } from 'crelte/client';
 *
 * main({
 *     app,
 *     errorPage,
 *     entryQuery,
 *     globalQuery,
 * });
 * ```
 */
export async function main(data: MainData) {
	// todo if entryQuery or globalQuery is present show a hint
	// they should be added to App.svelte and removed from here

	const config = configWithDefaults(data.app.config ?? {});
	const ssrCache = new SsrCache();

	// since cors could cause an issue we wan't to override the FRONTEND_URL
	// env variable, since the server will be reachable on any domain
	// which the frontend also gets served from
	ssrCache.set('FRONTEND_URL', window.location.origin);

	const serverError = ssrCache.get('ERROR');
	if (serverError) {
		// todo should this init the client, but maybe we just
		// want it as minimal as possible

		svelteMount(data.errorPage.default, {
			target: document.body,
			props: serverError,
		});
		return;
	}

	const csites = ssrCache.get('crelteSites') as SiteFromGraphQl[];
	const router = new ClientRouter(csites, {
		debugTiming: config.debugTiming ?? false,
		preloadOnMouseOver: config.preloadOnMouseOver ?? false,
	});

	const queries = newQueries(ssrCache, router.route.readonly(), config);
	const cookies = new ClientCookies();

	const crelte = newCrelte({
		config,
		ssrCache,
		plugins: new Plugins(),
		events: new Events(),
		globals: new Globals(),
		router: new Router(router),
		queries,
		cookies,
	});

	const app = new InternalApp(data.app);

	// setup plugins
	setupPlugins(crelte, app.plugins);
	app.init(crelte);

	router.onNewCrelteRequest = req => onNewCrelteRequest(crelte, req);

	router.onBeforeRequest = pluginsBeforeRequest;

	router.loadRunner.loadFn = (cr, opts) => loadFn(cr, app, opts);

	// render Space

	let appInstance: any;
	let routeProp: Writable<Route>;
	const renderApp = (route: Route) => {
		if (appInstance) {
			routeProp!.set(route);
			return;
		}

		routeProp = new Writable(route);
		appInstance = svelteMount(data.app.default, {
			target: document.body,
			props: { route: routeProp },
			context: new Map([['crelte', crelte]]),
			intro: config.playIntro,
		});
	};

	router.onError = e => {
		console.error('routing failed:', e, 'reloading trying to fix it');
		// since onError is called only on subsequent requests we should never
		// have an infinite loop here
		window.location.reload();
	};

	router.onRender = async (cr, readyForRoute, domUpdated) => {
		if (appInstance && cr.req.disableLoadData) {
			// if the app is already rendered and entry did not change
			// we just wan't to run domUpdated because we don't wan't to update anything

			const route = readyForRoute();
			cr.router._requestCompleted();
			// globals should not be run because they will be empty
			// since nobody called loadGlobalData (todo maybe globals should also,
			// know if it accepts updates)

			// todo should we wait a tick here?
			await tick();

			domUpdated(cr, route);

			return route;
		}

		const startTime = config.debugTiming ? Date.now() : null;

		let render = async () => {
			const route = readyForRoute();
			cr.router._requestCompleted();
			if (route.entryChanged) cr.globals.z_syncToStores();
			// we should trigger the route update here
			pluginsBeforeRender(cr, route);
			renderApp(route);

			await tick();

			if (startTime) {
				console.log(
					'dom update took ' + (Date.now() - startTime) + 'ms',
				);
			}

			domUpdated(cr, route);

			return route;
		};

		// render with view Transition if enabled and not in hydration
		if (
			config.viewTransition &&
			appInstance &&
			(document as any).startViewTransition
		) {
			const prevRender = render;
			render = async () =>
				new Promise(resolve => {
					(document as any).startViewTransition(async () => {
						resolve(await prevRender());
					});
				});
		}

		return await render();
	};

	// listen for a site change and update the lang attribute on the html tag
	router.site.subscribe(site => {
		if (!site) return;
		document.documentElement.lang = site.language;
	});

	try {
		await router.init();
	} catch (e) {
		// the first load we can't handle with a redirect since this might
		// cause an infinite loop
		// but since almost everything should be ssrCached nothing should fail
		handleLoadError(e);
	}
}

function handleLoadError(e: any) {
	console.log('loading or rendering the page failed with the error:');
	console.error(e);

	// Detect the browser language
	// @ts-ignore
	const userLang: string = navigator.language || navigator.userLanguage;

	// Messages in different languages
	const messages: Record<string, string> = {
		en: 'An error has occurred. Please reload the page or try again later.',
		de: 'Leider ist ein Fehler aufgetreten. Laden Sie die Seite neu, oder versuchen Sie es später noch mal.',
		fr: 'Une erreur s’est produite. Veuillez recharger la page ou réessayer plus tard.',
		it: 'Si è verificato un errore. Ricarica la pagina o riprova più tardi.',
		nl: 'Er is een fout opgetreden. Herlaad de pagina of probeer het later opnieuw.',
	};

	const message = messages[userLang.split('-')[0]] ?? messages.en;

	alert(message);
}
