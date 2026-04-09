import { SiteFromGraphQl } from '../routing/Site.js';
import {
	loadFn,
	newQueries,
	onNewCrelteRequest,
	pluginsAfterRender,
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
import ClientBodyClass from '../bodyClass/ClientBodyClass.js';
import { BodyClass } from '../bodyClass/index.js';
import { Cookies } from '../cookies/index.js';

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
 * #### Example
 * ```js
 * import * as app from './App.svelte';
 * import * as errorPage from './Error.svelte';
 * import { main } from 'crelte/client';
 *
 * main({ app, errorPage });
 * ```
 */
export async function main(data: MainData) {
	// todo if entryQuery or globalQuery is present show a hint
	// they should be added to App.svelte and removed from here

	const config = configWithDefaults(data.app.config ?? {});
	const ssrCache = new SsrCache();
	ssrCache.z_importFromHead();

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

	const crelte = newCrelte({
		config,
		ssrCache,
		plugins: new Plugins(),
		events: new Events(),
		globals: new Globals(),
		router: new Router(router),
		queries,
		cookies: new Cookies(new ClientCookies()),
		bodyClass: new BodyClass(new ClientBodyClass()),
	});

	const app = new InternalApp(data.app);

	// setup plugins
	setupPlugins(crelte, app.plugins);
	app.init(crelte);

	router.onNewCrelteRequest = req => onNewCrelteRequest(crelte, req);

	router.onBeforeRequest = pluginsBeforeRequest;

	router.loadRunner.loadFn = (cr, opts) => loadFn(cr, app, opts);

	// render Space

	let routeProp: Writable<Route> | null = null;
	const renderApp = (route: Route) => {
		if (routeProp) {
			routeProp.set(route);
			return;
		}

		routeProp = new Writable(route);
		svelteMount(data.app.default, {
			target: document.body,
			props: { route: routeProp },
			context: new Map([['crelte', crelte]]),
			intro: config.playIntro,
		});
	};
	const appMounted = () => !!routeProp;

	router.onError = (e, req) => {
		console.error('routing failed:', e, 'reloading trying to fix it');
		// since onError is called only on subsequent requests we should never
		// have an infinite loop here
		window.location.href = req.url.href;
	};

	router.onRender = async (cr, readyForRoute, domUpdated) => {
		if (appMounted() && cr.req.disableLoadData) {
			// if the app is already rendered and entry did not change
			// we just wan't to run domUpdated because we don't want to update anything

			const route = readyForRoute();
			cr.router.z_requestCompleted();
			// globals should not be run because they will be empty
			// since nobody called loadGlobalData (todo maybe globals should also,
			// know if it accepts updates)

			// todo should we wait a tick here?
			await tick();

			domUpdated(cr, route);
			pluginsAfterRender(cr, route);

			return route;
		}

		const startTime = config.debugTiming ? Date.now() : null;

		let render = async () => {
			const route = readyForRoute();
			cr.router.z_requestCompleted();
			// this is only important on the first render
			// else we will catch an earlier branch in onRender
			if (route.entryChanged) {
				cr.globals.z_syncToStores();
				pluginsBeforeRender(cr, route);
				cr.cookies.z_render();
				cr.bodyClass.z_render();
			}

			renderApp(route);

			await tick();

			if (startTime) {
				console.log(
					'dom update took ' + (Date.now() - startTime) + 'ms',
				);
			}

			domUpdated(cr, route);
			pluginsAfterRender(cr, route);

			return route;
		};

		// render with view Transition if enabled and not in hydration
		if (
			config.viewTransition &&
			appMounted() &&
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
		de: 'Leider ist ein Fehler aufgetreten. Laden Sie die Seite neu, oder versuchen Sie es später noch mal.',
		en: 'An error has occurred. Please reload the page or try again later.',
		fr: 'Une erreur s’est produite. Veuillez recharger la page ou réessayer plus tard.',
		it: 'Si è verificato un errore. Ricarica la pagina o riprova più tardi.',
		nl: 'Er is een fout opgetreden. Herlaad de pagina of probeer het later opnieuw.',
	};

	const message = messages[userLang.split('-')[0]] ?? messages.en;

	alert(message);
}
