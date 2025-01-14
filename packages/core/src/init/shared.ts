import Crelte from '../Crelte.js';
import CrelteRequest from '../CrelteRequest.js';
import { GraphQlQuery } from '../graphql/GraphQl.js';
import { LoadData, callLoadData } from '../loadData/index.js';
import { PluginCreator } from '../plugins/Plugins.js';
import { LoadOptions } from '../routing/PageLoader.js';

interface App<D, E, T> {
	loadGlobalData?: LoadData<D>;

	// todo: add a generic
	loadEntryData?: LoadData<any>;

	templates?: Record<string, LazyTemplateModule<E, T>>;
}

interface TemplateModule<E, T> {
	// svelte component
	default: any;

	loadData?(cr: CrelteRequest, entry: E): Promise<T>;
}

type LazyTemplateModule<E, T> =
	| (() => Promise<TemplateModule<E, T>>)
	| TemplateModule<E, T>;

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

export async function loadFn<D, E, T>(
	cr: CrelteRequest,
	app: App<D, E, T>,
	entryQuery: GraphQlQuery,
	globalQuery?: GraphQlQuery,
	loadOpts?: LoadOptions,
): Promise<any> {
	let dataProm: Promise<D> | null = null;
	// @ts-ignore
	if (app.loadData) {
		throw new Error(
			'loadData is ambigous, choose loadGlobalData or ' +
				'loadEntryData depending on if you need access to entry or not?',
		);
	}

	if (app.loadGlobalData) {
		dataProm = callLoadData(app.loadGlobalData, cr) as any;
	}

	let globalProm: Promise<any> | null = null;
	if (globalQuery && !cr.globals._wasLoaded()) {
		globalProm = (async () => {
			const res = await cr.query(globalQuery);
			// we need to do this sorcery here and can't wait until all
			// globals functions are done, because some global function
			// might want to use globals, and for that the function
			// getOrWait exists on Globals
			cr.globals._setData(cr.site.id, res);
			return res;
		})();
	}

	let pageProm = null;
	if (cr.req.site) {
		let uri = decodeURI(cr.req.uri);
		if (uri.startsWith('/')) uri = uri.substring(1);
		if (uri === '' || uri === '/') uri = '__home__';

		pageProm = cr.query(entryQuery, {
			uri,
			siteId: cr.req.site.id,
		});
	}

	const pluginsLoadGlobalData = cr.events.trigger('loadGlobalData', cr);

	// loading progress is at 20%
	loadOpts?.setProgress(0.2);

	const [data, global, page] = await Promise.all([
		dataProm,
		globalProm,
		pageProm,
		...pluginsLoadGlobalData,
	]);

	if (global) {
		cr.globals._setData(cr.site.id, global);
	} else if (!cr.globals._wasLoaded()) {
		// we need to set the global data to an empty object
		// so any waiters get's triggered
		cr.globals._setData(cr.site.id, {});
	}

	// allow cr to get the global data
	cr._globalDataLoaded();

	const entry = getEntry(page);

	let template;
	if (app.templates) {
		template = await loadTemplate(app.templates, entry);
	} else {
		throw new Error('App must have templates or loadTemplate method');
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

async function loadTemplate<E, T>(
	rawModules: Record<string, LazyTemplateModule<E, T>>,
	entry: E,
): Promise<TemplateModule<E, T>> {
	// parse modules
	const modules = new Map(
		Object.entries(rawModules)
			.map(([path, mod]) => {
				const [name, _ext] = parseFilename(path);
				return [name, mod] as [string, LazyTemplateModule<E, T>];
			})
			.filter(([name, _mod]) => !!name),
	);

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
