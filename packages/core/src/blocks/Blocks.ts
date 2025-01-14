import { CrelteRequest } from '../index.js';
import { callLoadData } from '../loadData/index.js';

export interface Module {
	// svelte component
	default: any;
	handle?: string | string[];
	keepTypeHandle?: boolean;

	loadData?: (block: any) => Promise<any>;
}

export type AsyncModule = (() => Promise<Module>) | Module;

export type BlockModulesOptions = {
	// if a block should handle multiple blocks
	alias?: Record<string, string>;
};

export class BlockModules {
	modules: Map<string, AsyncModule>;
	alias: Map<string, string>;

	constructor(
		modules: Record<string, AsyncModule>,
		opts: BlockModulesOptions = {},
	) {
		this.modules = new Map(
			Object.entries(modules)
				.map(([path, mod]) => {
					const [name, ext] = parseFilename(path);

					return [ext === 'svelte' ? name : '', mod] as [
						string,
						AsyncModule,
					];
				})
				.filter(([name, _mod]) => !!name),
		);

		this.alias = new Map(Object.entries(opts.alias ?? {}));

		// backwards compatibility allow to use the export const handle
		this.modules.forEach((mod, name) => {
			if (typeof mod === 'function') return;

			if (mod.handle) {
				const handles = Array.isArray(mod.handle)
					? mod.handle
					: [mod.handle];
				handles.forEach(handle => {
					this.alias.set(handle, name);
				});
			}
		});
	}

	/**
	 * Loads the required modules
	 *
	 * @throws an error if a module is not found
	 */
	async load(requiredModules: Set<string>): Promise<Map<string, Module>> {
		const loaded = await Promise.all(
			[...requiredModules.keys()].map(mod => {
				let module = this.modules.get(mod);
				if (!module)
					module = this.modules.get(this.alias.get(mod) ?? '');

				if (!module) throw new Error(`Module ${mod} not found`);

				return typeof module === 'function' ? module() : module;
			}),
		);

		// todo once loaded override it in module again

		return new Map<string, Module>(
			[...requiredModules.keys()].map((mod, i) => [mod, loaded[i]]),
		);
	}
}

export async function newBlocks(blocks: any[], modules: BlockModules) {
	// define all required modules
	const requiredModules: Set<string> = new Set();

	for (const block of blocks) {
		if (!block.typeHandle) throw new Error('Block must have a typeHandle');

		requiredModules.add(block.typeHandle);
	}

	const loadedModules = await modules.load(requiredModules);

	return new Blocks(blocks, loadedModules);
}

export default class Blocks {
	blocks: any[];
	data: any[];
	modules: Map<string, Module>;

	constructor(blocks: any[], modules: Map<string, Module>) {
		this.blocks = blocks;
		this.modules = modules;
		this.data = blocks.map(() => null);
	}

	async loadData(cr: CrelteRequest) {
		this.data = await Promise.all(
			this.blocks.map((block, i) => {
				const mod = this.modules.get(block.typeHandle)!;

				if ('loadData' in mod) {
					return callLoadData(mod.loadData, cr, block, {
						getSibling: (offset: number) => {
							return this.blocks[i + offset] ?? null;
						},
					});
				}

				return {};
			}),
		);
	}

	each(): { mod: any; props: any }[] {
		return this.blocks.map((block, i) => {
			const mod = this.modules.get(block.typeHandle)!;

			const props = { ...block };
			if (!mod.keepTypeHandle) delete props.typeHandle;
			Object.assign(props, this.data[i]);

			return {
				mod: mod.default,
				props,
			};
		});
	}
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
