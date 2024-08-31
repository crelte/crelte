import { CrelteBuilder } from '../Crelte.js';
import { SiteFromGraphQl } from '../routing/Site.js';
import { loadFn, pluginsBeforeRender, setupPlugins } from './shared.js';
import { tick } from 'svelte';

export type MainData = {
	/// svelte app component
	app: any;
	/// error page
	errorPage: any;
	entryQuery: any;
	globalQuery?: any;

	// options
	preloadOnMouseOver?: boolean;
	viewTransition?: boolean;
	playIntro?: boolean;

	// debug
	graphQlDebug?: boolean;
	debugTiming?: boolean;
};

const mainDataDefault = {
	preloadOnMouseOver: false,
	viewTransition: false,
	playIntro: false,

	// will be passed down to ClientRenderer
	graphQlDebug: false,
	debugTiming: false,
};

export function main(data: MainData) {
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

	const builder = new CrelteBuilder();
	const endpoint = builder.ssrCache.get('ENDPOINT_URL') as string;
	builder.setupGraphQl(endpoint, {
		debug: data.graphQlDebug,
		debugTiming: data.debugTiming,
	});

	// on the client the cookies are always comming from document.cookie
	builder.setupCookies('');

	const csites = builder.ssrCache.get('crelteSites') as SiteFromGraphQl[];
	builder.setupRouter(csites, {
		preloadOnMouseOver: data.preloadOnMouseOver,
	});

	const crelte = builder.build();

	const serverError = crelte.ssrCache.get('ERROR');
	if (serverError) {
		// should this be called??
		crelte.router._internal.initClient();

		new data.errorPage.default({
			target: document.body,
			props: { ...serverError },
			hydrate: true,
			context: crelte._getContext(),
		});
		return;
	}

	// setup plugins
	setupPlugins(crelte, data.app.plugins ?? []);

	// setup load Data

	crelte.router._internal.onLoad = (route, site, opts) => {
		const cr = crelte.toRouted(route, site);
		return loadFn(cr, data.app, data.entryQuery, data.globalQuery, opts);
	};

	// render Space

	let appInstance: any;
	const render = (props: any) => {
		if (!appInstance) {
			appInstance = new data.app.default({
				target: document.body,
				props,
				hydrate: true,
				context: crelte._getContext(),
				intro: data.playIntro,
			});
		} else {
			appInstance.$set(props);
		}
	};

	let prepareRenderVersion = 0;
	crelte.router._internal.onLoaded = async (
		success,
		route,
		site,
		readyForProps,
	) => {
		if (!success) return handleLoadError(readyForProps());

		const cr = crelte.toRouted(route, site);

		// is it possible to delay the opts change for example if we wan't to run an animation to
		// completion first?
		if (appInstance && data.app.prepareNewRender) {
			const prevVersion = ++prepareRenderVersion;
			await data.app.prepareNewRender(appInstance, cr);

			if (prevVersion !== prepareRenderVersion) return;
		}

		const startTime = data.debugTiming ? Date.now() : null;

		optionalStartViewTransition(
			data.viewTransition && appInstance,
			async () => {
				// we should trigger the route update here
				pluginsBeforeRender(cr);
				crelte.globals._updateSiteId(site.id);
				render(readyForProps());

				await tick();

				if (startTime) {
					console.log(
						'dom update took ' + (Date.now() - startTime) + 'ms',
					);
				}

				crelte.router._internal.domReady(route);
			},
		);
	};

	crelte.router._internal.initClient();
}

function optionalStartViewTransition(enabled = false, cb: () => Promise<any>) {
	// @ts-ignore
	if (!enabled || !document.startViewTransition) {
		cb();
		return;
	}

	// @ts-ignore
	document.startViewTransition(cb);
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
