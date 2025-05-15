import { Writable } from 'crelte-std/stores';
import { CrelteBuilder } from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import { GraphQlQuery } from '../graphql/GraphQl.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import { pluginsBeforeRender, prepareLoadFn, setupPlugins } from './shared.js';
import { tick } from 'svelte';
import { svelteMount } from './svelteComponents.js';

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

	// rendering steps

	// loadSites (first time)
	// determine route (if site is empty on server redirect to correct language)
	// loadData, entry (make globally available), pluginsData
	// loadTemplate
	// render

	// on route change
	// determine route
	// entry, pluginsData
	// loadTemplate
	// update

	// construct Crelte

	const builder = new CrelteBuilder(data.app.config ?? {});
	const endpoint = builder.ssrCache.get('ENDPOINT_URL') as string;
	builder.setupGraphQl(endpoint);

	// on the client the cookies are always coming from document.cookie
	builder.setupCookies('');

	const csites = builder.ssrCache.get('crelteSites') as SiteFromGraphQl[];
	builder.setupRouter(csites);

	const crelte = builder.build();

	const serverError = crelte.ssrCache.get('ERROR');
	if (serverError) {
		// should this be called??
		crelte.router._internal.initClient();

		svelteMount(data.errorPage.default, {
			target: document.body,
			props: { ...serverError },
			context: crelte._getContext(),
		});
		return;
	}

	// setup plugins
	setupPlugins(crelte, data.app.plugins ?? []);
	data.app.init?.(crelte);

	const loadFn = await prepareLoadFn(
		crelte,
		data.app,
		data.entryQuery,
		data.globalQuery,
	);

	// setup load Data

	crelte.router._internal.onLoad = (req, opts) => {
		const cr = new CrelteRequest(crelte, req);
		return loadFn(cr, opts);
	};

	// render Space

	let appInstance: any;
	let propsStore: Writable<any> | null = null;
	const updateAppProps = (props: any) => {
		if (!propsStore) {
			propsStore = new Writable(props);
			appInstance = svelteMount(data.app.default, {
				target: document.body,
				props: { props: propsStore },
				context: crelte._getContext(),
				intro: builder.config.playIntro,
			});
		} else {
			propsStore.set(props);
		}
	};

	let firstLoad = true;
	crelte.router._internal.onLoaded = async (success, req, readyForProps) => {
		const isFirstLoad = firstLoad;
		firstLoad = false;

		if (!success) {
			// if this is not the first load we should reload the page
			// we don't reload everytime because this might cause a reload loop
			// and since the first load will probably just contain ssrCache data
			// in almost all cases the first load will never faill
			if (!isFirstLoad) {
				// the load might contain a js error and we prefer the error
				// page
				window.location.reload();
				return;
			}

			return handleLoadError(readyForProps());
		}

		const cr = new CrelteRequest(crelte, req);

		const startTime = builder.config.debugTiming ? Date.now() : null;
		let render = async () => {
			// we should trigger the route update here
			pluginsBeforeRender(cr);
			crelte.globals._updateSiteId(cr.site.id);
			updateAppProps(readyForProps());

			await tick();

			if (startTime) {
				console.log(
					'dom update took ' + (Date.now() - startTime) + 'ms',
				);
			}

			crelte.router._internal.domReady(cr.req);
		};

		// render with view Transition if enabled and not in hydration
		if (
			builder.config.viewTransition &&
			appInstance &&
			(document as any).startViewTransition
		) {
			render = () => (document as any).startViewTransition(render);
		}

		await render();
	};

	crelte.router._internal.onNothingLoaded = async (req, ready) => {
		crelte.globals._updateSiteId(req.site.id);
		ready();

		await tick();

		crelte.router._internal.domReady(req);
	};

	crelte.router._internal.initClient();
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
