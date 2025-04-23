import Crelte from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import EntryRouter, { EntryRoutes } from '../entry/EntryRouter.js';
import { GraphQlQuery } from '../graphql/GraphQl.js';
import { Entry } from '../index.js';
import { LoadData, callLoadData } from '../loadData/index.js';
import { PluginCreator } from '../plugins/Plugins.js';
import { LoadOptions } from '../routing/PageLoader.js';

interface App {
	loadGlobalData?: LoadData<null>;

	// todo: add a generic
	loadEntryData?: LoadData<Entry>;

	templates?: Record<string, LazyTemplateModule>;

	entryRoutes?: EntryRoutes;

	init?: (crelte: Crelte) => void;
}

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

/**
 * Get the entry from the page
 *
 * entries should export sectionHandle and typeHandle
 *
 * products should alias productTypeHandle with typeHandle,
 * sectionHandle will be automatically set to product
 */
export function getEntry(page: any): any {
	if (page?.entry) return { ...page.entry };
	if (page?.product)
		return {
			sectionHandle: 'product',
			...page.product,
		};

	return {
		sectionHandle: 'error',
		typeHandle: '404',
	};
}

// todo it would be nice to call this only once per server start
export async function prepareLoadFn(
	crelte: Crelte,
	app: App,
	entryQuery: GraphQlQuery,
	globalQuery?: GraphQlQuery,
): Promise<(cr: CrelteRequest, loadOpts?: LoadOptions) => Promise<any>> {
	const templateModules = prepareTemplates(app.templates ?? {});
	let entryRouter: EntryRouter | null = null;
	if (app.entryRoutes) {
		entryRouter = new EntryRouter(crelte);
		await app.entryRoutes(entryRouter);
	}

	return async (cr, loadOpts) => {
		return await loadFn(
			cr,
			app,
			templateModules,
			entryRouter,
			entryQuery,
			globalQuery,
			loadOpts,
		);
	};
}

async function loadFn(
	cr: CrelteRequest,
	app: App,
	templateModules: Map<string, LazyTemplateModule>,
	entryRouter: EntryRouter | null,
	entryQuery: GraphQlQuery,
	globalQuery?: GraphQlQuery,
	loadOpts?: LoadOptions,
): Promise<any> {
	let dataProm: Promise<any> | null = null;
	// @ts-ignore
	if (app.loadData) {
		throw new Error(
			'loadData is ambigous, choose loadGlobalData or ' +
				'loadEntryData depending on if you need access to entry or not?',
		);
	}

	if (app.loadGlobalData) {
		dataProm = callLoadData(app.loadGlobalData, cr, null) as any;
	}

	let globalProm: Promise<any> | null = null;
	if (globalQuery && !cr.globals._wasLoaded(cr.site.id)) {
		globalProm = (async () => {
			const res = await cr.query(globalQuery, {
				siteId: cr.site.id,
			});
			// we need to do this sorcery here and can't wait until all
			// globals functions are done, because some global function
			// might want to use globals, and for that the function
			// getAsync exists on Globals
			cr.globals._setData(cr.site.id, res);
			return res;
		})();
	}

	const entryProm = queryEntry(cr, app, entryRouter, entryQuery);

	const pluginsLoadGlobalData = cr.events.trigger('loadGlobalData', cr);

	// loading progress is at 20%
	loadOpts?.setProgress(0.2);

	const [data, global, entry] = await Promise.all([
		dataProm,
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

function parseFilename(path: string): [string, string] {
	// get filename with extension
	const slash = path.lastIndexOf('/');
	const filename = path.substring(slash + 1);

	const extPos = filename.lastIndexOf('.');

	const name = filename.substring(0, extPos);
	const ext = filename.substring(extPos + 1);

	return [name, ext];
}

async function queryEntry(
	cr: CrelteRequest,
	app: App,
	entryRouter: EntryRouter | null,
	entryQuery: GraphQlQuery,
): Promise<any | null> {
	// check
	if (entryRouter) {
		const entry = await entryRouter._handle(cr);
		if (entry) return entry;
	}

	if (cr.req.siteMatches()) {
		let uri = decodeURI(cr.req.uri);
		if (uri.startsWith('/')) uri = uri.substring(1);
		if (uri === '' || uri === '/') uri = '__home__';

		const page = await cr.query(entryQuery, {
			uri,
			siteId: cr.site.id,
		});

		return getEntry(page);
	}

	return null;
}

function prepareTemplates(
	rawModules: Record<string, LazyTemplateModule>,
): Map<string, LazyTemplateModule> {
	// parse modules
	return new Map(
		Object.entries(rawModules)
			.map(([path, mod]) => {
				const [name, _ext] = parseFilename(path);
				return [name, mod] as [string, LazyTemplateModule];
			})
			.filter(([name, _mod]) => !!name),
	);
}

async function loadTemplate(
	modules: Map<string, LazyTemplateModule>,
	entry: Entry,
): Promise<TemplateModule> {
	const entr = entry as any;
	const handle = `${entr.sectionHandle}-${entr.typeHandle}`;

	if (
		// @ts-ignore
		import.meta.env.DEV &&
		!modules.has(handle) &&
		!modules.has(entr.sectionHandle)
	) {
		console.error(
			`Template not found: <${handle}>, expecting file: ${handle}.svelte or ${entr.sectionHandle}.svelte`,
		);
	}

	const loadMod =
		modules.get(handle) ??
		modules.get(entr.sectionHandle) ??
		modules.get('error-404');
	if (!loadMod) throw new Error('could not find error-404 template');

	if (typeof loadMod === 'function') {
		return await loadMod();
	}
	return loadMod;
}
