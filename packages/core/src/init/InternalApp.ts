import { Entry } from '../entry/index.js';
import { Crelte } from '../index.js';
import { LoadData } from '../loadData/index.js';
import { PluginCreator } from '../plugins/index.js';

export interface App {
	plugins?: PluginCreator[];

	templates?: Record<string, LazyTemplateModule>;

	loadGlobalData?: LoadData<null>;

	// todo: add a generic
	loadEntryData?: LoadData<Entry>;

	// entryRoutes?: EntryRoutes;

	init?: (crelte: Crelte) => void;
}

export interface TemplateModule {
	// svelte component
	default: any;

	loadData?: LoadData<Entry>;
}

export type LazyTemplateModule =
	| (() => Promise<TemplateModule>)
	| TemplateModule;

export type TemplateModules = Map<string, LazyTemplateModule>;

export default class InternalApp {
	inner: App;
	templateModules: TemplateModules;

	constructor(inner: App) {
		this.inner = inner;
		this.templateModules = prepareTemplates(inner.templates ?? {});
	}

	get plugins(): PluginCreator[] {
		return this.inner.plugins ?? [];
	}

	init(crelte: Crelte): void {
		this.inner.init?.(crelte);
	}
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

function parseFilename(path: string): [string, string] {
	// get filename with extension
	const slash = path.lastIndexOf('/');
	const filename = path.substring(slash + 1);

	const extPos = filename.lastIndexOf('.');

	const name = filename.substring(0, extPos);
	const ext = filename.substring(extPos + 1);

	return [name, ext];
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
