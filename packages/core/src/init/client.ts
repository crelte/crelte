import { CrelteBuilder } from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import {
	loadFn,
	pluginsBeforeRender,
	pluginsBeforeRequest,
	setupPlugins,
} from './shared.js';
import { tick } from 'svelte';
import { svelteMount } from './svelteComponents.js';
import ClientCookies from '../cookies/ClientCookies.js';
import ClientRouter from '../routing/ClientRouter.js';
import InternalApp from './InternalApp.js';
import { Route } from '../routing/index.js';
import { Writable } from 'crelte-std/stores';

/**
 * The main function to start the client side rendering
 */
export type MainData = {
	/** The App.svelte module */
	app: any;
	/** The Error.svelte module */
	errorPage: any;
};

const mainDataDefault = {
	preloadOnMouseOver: false,
	viewTransition: false,
	playIntro: false,
	XCraftSiteHeader: false,

	// will be passed down to ClientRenderer
	graphQlDebug: false,
	debugTiming: false,
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
	data = { ...mainDataDefault, ...data };

	// todo if entryQuery or globalQuery is present show a hint
	// they should be added to App.svelte and removed from here

	const builder = new CrelteBuilder(data.app.config ?? {});

	const serverError = builder.ssrCache.get('ERROR');
	if (serverError) {
		// todo should this init the client, but maybe we just
		// want it as minimal as possible

		svelteMount(data.errorPage.default, {
			target: document.body,
			props: serverError,
		});
		return;
	}

	const endpoint = builder.ssrCache.get('ENDPOINT_URL') as string;
	builder.setupGraphQl(endpoint);

	// on the client the cookies are always coming from document.cookie
	builder.setupCookies(new ClientCookies());

	const csites = builder.ssrCache.get('crelteSites') as SiteFromGraphQl[];
	const router = new ClientRouter(csites, {
		debugTiming: builder.config.debugTiming ?? false,
		preloadOnMouseOver: builder.config.preloadOnMouseOver ?? false,
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
			context: crelte._getContext(),
			intro: builder.config.playIntro,
		});
	};

	router.onError = e => {
		console.error('routing failed:', e, 'reloading trying to fix it');
		// since onError is called only on subsequent requests we should never
		// have an infinite loop here
		window.location.reload();
	};

	// let firstLoad = true;
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

		const startTime = builder.config.debugTiming ? Date.now() : null;

		let render = async () => {
			const route = readyForRoute();
			cr.router._requestCompleted();
			cr.globals._syncToStores();
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
			builder.config.viewTransition &&
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
