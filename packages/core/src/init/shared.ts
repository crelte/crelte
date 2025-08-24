import Crelte from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import { GraphQlQuery, isGraphQlQuery } from '../graphql/GraphQl.js';
import { Entry } from '../index.js';
import { callLoadData } from '../loadData/index.js';
import { PluginCreator } from '../plugins/Plugins.js';
import { LoadOptions } from '../routing/LoadRunner.js';
import { isPromise } from '../utils.js';
import InternalApp, { TemplateModule } from './InternalApp.js';
import Route from '../routing/Route.js';

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

// This should be onRequest or handle Request
//
// it should also handle the site redirect and stuff like that
// we should have a onRequest

export async function loadFn(
	cr: CrelteRequest,
	app: InternalApp,
	loadOpts?: LoadOptions,
): Promise<void> {
	const isCanceled = () => !!loadOpts?.isCanceled();

	// loadGlobalData phase

	let globalProm: Promise<any> | null = null;

	if (app.loadGlobalData) {
		// we need to set the globals as soon as loadGlobalData completes
		// because other loadGlobalData functions might wait on the result
		globalProm = (async () => {
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
	}

	// todo maybe each setting of the property on the request should be
	// checked to be empty before doing it
	const entryProm = (async () => {
		let loadEntry = app.loadEntry;
		if (isGraphQlQuery(loadEntry)) {
			loadEntry = cr => queryEntry(cr, loadEntry as GraphQlQuery);
		}

		let entry: Entry = await callLoadData(loadEntry, cr, null);
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

	const [_global, [entry, template]] = await Promise.all([
		globalProm,
		entryProm,
		...pluginsLoadGlobalData,
	]);
	if (isCanceled()) return;

	cr.globals._globalsLoaded();

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

export async function queryEntry(
	cr: CrelteRequest,
	entryQuery: GraphQlQuery,
): Promise<Entry> {
	if (!cr.req.siteMatches())
		throw new Error(
			'to run the entryQuery the request needs to have a matching site',
		);

	let uri = decodeURI(cr.req.uri);
	if (uri.startsWith('/')) uri = uri.substring(1);
	if (uri === '' || uri === '/') uri = '__home__';

	const vars = {
		uri,
		siteId: cr.site.id,
	};

	const page = await cr.query(entryQuery, vars);
	return getEntry(page) ?? ERROR_404_ENTRY;
}

const ERROR_404_ENTRY: Entry = {
	sectionHandle: 'error',
	typeHandle: '404',
};

/**
 * Get the entry from the page
 *
 * entries should export sectionHandle and typeHandle
 *
 * products should alias productTypeHandle with typeHandle,
 * sectionHandle will be automatically set to product
 */
function getEntry(page: any): Entry | null {
	if (page?.entry) return { ...page.entry };
	if (page?.product)
		return {
			sectionHandle: 'product',
			...page.product,
		};

	return null;
}
