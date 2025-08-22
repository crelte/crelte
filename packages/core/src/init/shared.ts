import Crelte from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import EntryRouter, { EntryRoutes } from '../entry/EntryRouter.js';
import { EntryQueryVars } from '../entry/index.js';
import { GraphQlQuery, isGraphQlQuery } from '../graphql/GraphQl.js';
import { Entry } from '../index.js';
import { LoadData, callLoadData } from '../loadData/index.js';
import { PluginCreator } from '../plugins/Plugins.js';
import { LoadOptions } from '../routing/LoadRunner.js';
import { App } from './InternalApp.js';

interface TemplateModule {
	// svelte component
	default: any;

	loadData?: LoadData<Entry>;
}

type LazyTemplateModule = (() => Promise<TemplateModule>) | TemplateModule;

export function setupPlugins(crelte: Crelte, plugins: PluginCreator[]) {
	for (const plugin of plugins) {
		const p = plugin(crelte);
		crelte.plugins.add(p);
	}
}

export function pluginsBeforeRender(cr: CrelteRequest): void {
	cr.events.trigger('beforeRender', cr);
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

export async function loadFn(
	cr: CrelteRequest,
	app: App,
	loadOpts?: LoadOptions,
): Promise<void> {
	let globalProm: Promise<any> | null = null;

	if (app.loadGlobalData) {
		// todo this needs to be better
		// since some properties might depend on the other one
		// or is that not possible inside the same loadGlobalData?
		// maybe for the moment its enough to wrap this in a promise
		// and as soon as we get an object sett ot to the globals
		globalProm = callLoadData(app.loadGlobalData, cr, null);
	}

	// let globalProm: Promise<any> | null = null;
	// if (globalQuery && !cr.globals._wasLoaded(cr.site.id)) {
	// 	globalProm = (async () => {
	// 		const res = await cr.query(globalQuery, {
	// 			siteId: cr.site.id,
	// 		});
	// 		// we need to do this sorcery here and can't wait until all
	// 		// globals functions are done, because some global function
	// 		// might want to use globals, and for that the function
	// 		// getAsync exists on Globals
	// 		cr.globals._setData(cr.site.id, res);
	// 		return res;
	// 	})();
	// }
	//
	let loadEntry = app.loadEntry;
	if (isGraphQlQuery(loadEntry)) {
		loadEntry = cr => queryEntry(cr, loadEntry as GraphQlQuery);
	}

	const entryProm = callLoadData(loadEntry, cr, null);

	const pluginsLoadGlobalData = cr.events.trigger('loadGlobalData', cr);

	// loading progress is at 20%
	loadOpts?.setProgress(0.2);

	const [global, entry] = await Promise.all([
		globalProm,
		entryProm,
		...pluginsLoadGlobalData,
	]);

	// global is only set if !wasLoaded but we need to store something
	// even if no globalQuery exists
	if (global || !cr.globals._wasLoaded(cr.site.id)) {
		cr.globals._setData(cr.site.id, global ?? {});
	}

	let template;
	if (app.templates) {
		template = await loadTemplate(templateModules, entry);
	} else {
		throw new Error('App must export some templates');
	}

	// loading progress is at 60%
	loadOpts?.setProgress(0.6);

	const pluginsLoadData = cr.events.trigger('loadData', cr, entry);

	let loadDataProm = null;
	if (template.loadData) {
		loadDataProm = callLoadData(template.loadData, cr, entry);
	}

	let entryDataProm: Promise<any> | null = null;
	if (app.loadEntryData) {
		entryDataProm = callLoadData(app.loadEntryData, cr, entry) as any;
	}

	const [templateData, entryData] = await Promise.all([
		loadDataProm,
		entryDataProm,
		...pluginsLoadData,
	]);

	// loading progress is at 100%
	loadOpts?.setProgress(1);

	return {
		...data,
		...entryData,
		entry,
		template: template.default,
		templateData: templateData! as any,
	};
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

	// // basic query function
	// let loadFn = async (vars: EntryQueryVars | null) => {
	// 	const page = await cr.query(entryQuery, vars);

	// 	return getEntry(page);
	// };

	// // check if a plugin wants to override the query
	// // const fns = cr.events.getListeners('queryEntry');
	// // for (const fn of fns) {
	// // 	const prevLoadFn = loadFn;
	// // 	loadFn = async vars => {
	// // 		return await fn(cr, vars, prevLoadFn);
	// // 	};
	// // }

	// const entry = (await loadFn(vars)) ?? ERROR_404_ENTRY;

	// // await Promise.all(cr.events.trigger('afterQueryEntry', cr, entry));

	// return entry;
}
