import {
	callLoadData,
	Entry,
	entryQueryVars,
	queryEntry,
} from '../loadData/index.js';
import { PluginCreator } from '../plugins/Plugins.js';
import { LoadOptions } from '../routing/LoadRunner.js';
import { isPromise } from '../utils.js';
import InternalApp, { TemplateModule } from './InternalApp.js';
import { Route, Request } from '../routing/index.js';
import SsrCache from '../ssr/SsrCache.js';
import { Crelte, Config, CrelteRequest, crelteToRequest } from '../crelte.js';
import Queries, { isQuery, Query } from '../queries/Queries.js';
import { Readable } from '../std/stores/index.js';
import { timeout } from '../std/index.js';

export function setupPlugins(crelte: Crelte, plugins: PluginCreator[]) {
	for (const plugin of plugins) {
		const p = plugin(crelte);
		crelte.plugins.add(p);
	}
}

export function pluginsBeforeRequest(cr: CrelteRequest): Promise<void> | void {
	const res = cr.events.trigger('beforeRequest', cr);
	// if one of them is a promise we need to wait for it
	if (res.some(isPromise)) {
		return Promise.all(res).then();
	}
}

export function pluginsBeforeRender(cr: CrelteRequest, route: Route): void {
	cr.events.trigger('beforeRender', cr, route);
}

export function newQueries(
	ssrCache: SsrCache,
	route: Readable<Route | null>,
	config: Required<Config>,
) {
	return Queries.new(
		ssrCache.get('ENDPOINT_URL') as string,
		// on the client this will be the same as window.location.origin
		ssrCache.get('FRONTEND_URL') as string,
		ssrCache,
		{
			route,
			XCraftSiteHeader: config.XCraftSiteHeader,
			debug: config.debugQueries,
			debugTiming: config.debugTiming,
		},
	);
}

export function onNewCrelteRequest(
	crelte: Crelte,
	req: Request,
): CrelteRequest {
	// crelte gets first modified into "requestMode" and then converted
	// into a CrelteRequest because else some helper functions
	// might refer to the wrong objects/classes
	const nCrelte = {
		...crelte,
		router: crelte.router.z_toRequest(req),
		queries: crelte.queries.z_toRequest(req),
		globals: crelte.globals.z_toRequest(),
	};
	return crelteToRequest(nCrelte, req);
}

async function pluginsLoadEntry(cr: CrelteRequest): Promise<Entry | null> {
	const listeners = cr.events.getListeners('loadEntry');

	for (const loadEntry of listeners) {
		const entry = await loadEntry(cr);
		if (entry) return entry;
	}

	return null;
}

async function loadEntryFromQuery(
	cr: CrelteRequest,
	entryQuery: Query,
): Promise<Entry> {
	const queryVars = entryQueryVars(cr);
	await Promise.all(cr.events.trigger('beforeQueryEntry', cr, queryVars));
	return queryEntry(cr, entryQuery, queryVars);
}

export async function loadFn(
	cr: CrelteRequest,
	app: InternalApp,
	loadOpts?: LoadOptions,
): Promise<void> {
	const isCanceled = () => !!loadOpts?.isCanceled();

	// loadGlobalData phase

	// we need to set the globals as soon as loadGlobalData completes
	// because other loadGlobalData functions might wait on the result
	const globalProm = (async () => {
		// todo theoretically we could if the loadData is a an LoadObject
		// assign each to the global as soon as we have it. Which might
		// prevent some deadlocks but i don't think this will happen
		// often
		const globals = await callLoadData(app.loadGlobalData, cr, null);
		if (!globals) return globals;

		if (typeof globals !== 'object') {
			throw new Error(
				'loadGlobalData needs to return an object or nothing',
			);
		}

		for (const [k, v] of Object.entries(globals)) {
			cr.globals.set(k, v);
		}
	})();

	// todo maybe each setting of the property on the request should be
	// checked to be empty before doing it
	const entryProm = (async () => {
		// first let's try to call the plugin loadEntry
		let entry = await pluginsLoadEntry(cr);
		if (isCanceled()) return [];

		// if no plugin provides an entry we load it from the app
		if (!entry) {
			// todo, maybe we should remove loadEntry from app
			// since you can do almost everything with a event?
			let loadEntry = app.loadEntry;
			if (isQuery(loadEntry)) {
				const entryQuery = loadEntry;
				loadEntry = cr => loadEntryFromQuery(cr, entryQuery);
			}

			entry = (await callLoadData(loadEntry, cr, null)) as Entry;
		}
		if (isCanceled()) return [];
		cr.req.entry = entry;

		await Promise.all(cr.events.trigger('afterLoadEntry', cr));
		if (isCanceled()) return [];
		entry = cr.req.entry;

		const template = await app.loadTemplate(entry);
		if (isCanceled()) return [];
		cr.req.template = template;

		return [entry, template] as [Entry, TemplateModule];
	})();

	const pluginsLoadGlobalData = cr.events.trigger('loadGlobalData', cr);

	// loading progress is at 20%
	loadOpts?.setProgress(0.2);

	const loadGlobalDataProm = Promise.all([
		globalProm,
		entryProm,
		...pluginsLoadGlobalData,
	]);

	// if globals take longer than 2 seconds to load in dev mode
	// we force resolve them to prevent deadlocks
	if (
		import.meta.env.DEV &&
		!(await Promise.any([loadGlobalDataProm, timeout(2000)]))
	) {
		console.error(
			'DEV: globals took longer than 2 seconds to load. ' +
				'Resolving globals now to fix potential deadlocks',
		);
		cr.globals.z_globalsLoaded();
	}

	const [_global, [entry, template]] = await loadGlobalDataProm;
	if (isCanceled()) return;

	cr.globals.z_globalsLoaded();

	// loading progress is at 60%
	loadOpts?.setProgress(0.6);

	const pluginsLoadData = cr.events.trigger('loadData', cr, entry);

	let loadDataProm = null;
	if (template.loadData) {
		loadDataProm = callLoadData(template.loadData, cr, entry);
	}

	let entryDataProm: Promise<any> | null = null;
	if (app.loadEntryData) {
		entryDataProm = callLoadData(app.loadEntryData, cr, entry);
	}

	const [templateData, entryData] = await Promise.all([
		loadDataProm,
		entryDataProm,
		...pluginsLoadData,
	]);

	cr.req.loadedData = {
		...templateData,
		...entryData,
	};

	// loading progress is at 100%
	loadOpts?.setProgress(1);
}
