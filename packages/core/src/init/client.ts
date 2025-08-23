import { CrelteBuilder } from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import { GraphQlQuery } from '../graphql/GraphQl.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import {
	loadFn,
	pluginsBeforeRender,
	pluginsBeforeRequest,
	prepareLoadFn,
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
	/** The entry query from queries/entry.graphql */
	entryQuery: GraphQlQuery;
	/** The global query from queries/global.graphql */
	globalQuery?: GraphQlQuery;
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
	});
	builder.setupRouter(router);

	const crelte = builder.build();

	const app = new InternalApp(data.app);

	// setup plugins
	setupPlugins(crelte, app.plugins);
	app.init(crelte);

	router.onNewCrelteRequest = req => {
		const cr = new CrelteRequest(crelte, req);
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

	// let firstLoad = true;
	router.onRender = async (cr, readyForRoute, domUpdated) => {
		if (appInstance && cr.req.disableLoadData) {
			// if the app is already rendered and entry did not change
			// we just wan't run domUpdated because we don't wan't to update anything

			const route = readyForRoute();
			// globals should not be run because they will be empty
			// since nobody called loadGlobalData (todo maybe globals should also,
			// know if it accepts updates)

			// todo should we wait a tick here?
			await tick();

			domUpdated(cr, route);

			return route;
		}

		// const isFirstLoad = firstLoad;
		// firstLoad = false;

		// if (!success) {
		// 	// if this is not the first load we should reload the page
		// 	// we don't reload everytime because this might cause a reload loop
		// 	// and since the first load will probably just contain ssrCache data
		// 	// in almost all cases the first load will never faill
		// 	if (!isFirstLoad) {
		// 		// the load might contain a js error and we prefer the error
		// 		// page
		// 		window.location.reload();
		// 		return;
		// 	}

		// 	// todo should we even call readyForProps here?
		// 	return handleLoadError(readyForProps());
		// }

		const startTime = builder.config.debugTiming ? Date.now() : null;
		let render = async () => {
			const route = readyForRoute();
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
