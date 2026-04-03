import { Crelte, CrelteRequest } from '../crelte.js';
import { Request, Route } from '../routing/index.js';

/**
 * A plugin
 */
export interface Plugin {
	name: string;
	/**
	 * The returned value will be used inside of CrelteRequest
	 */
	toRequest?: (req: Request) => Plugin;

	/**
	 * This will be called during the loadGlobalData phase.
	 */
	loadGlobalData?: (cr: CrelteRequest) => Promise<void> | void;

	/**
	 * This will be called during the loadData phase.
	 */
	loadData?: (cr: CrelteRequest) => Promise<void> | void;

	/**
	 * This will be called before the dom gets updated.
	 *
	 * At this point you can update variables or stores.
	 */
	render?: (cr: CrelteRequest, route: Route) => void;
}

/**
 * A plugin create function
 *
 * Each plugin needs to export a createPluginname function which will be called
 * by crelte to create the plugin. If youre plugin has options you can create
 * a configurePluginname function which will be called by youre user and should
 * return a createPlugin function.
 *
 * #### Example App.svelte in module="context"
 * ```js
 * import { createPlugin, configurePlugin } from 'some-plugin';
 *
 * export plugins = [createPlugin, configurePlugin({ enableFeature: true })];
 * ```
 */
export type PluginCreator = (crelte: Crelte) => Plugin;

/**
 * A plugin manager
 */
export default class Plugins {
	plugins: Map<string, Plugin>;

	constructor() {
		this.plugins = new Map();
	}

	/**
	 * @hidden
	 *
	 * Plugins should be added via App.svelte plugins export
	 */
	add(plugin: Plugin) {
		this.plugins.set(plugin.name, plugin);
	}

	get(name: string): Plugin | null {
		return this.plugins.get(name) ?? null;
	}

	/**
	 * @hidden
	 */
	z_toRequest(req: Request): Plugins {
		const nPlugins = new Plugins();

		for (let plugin of this.plugins.values()) {
			if (typeof plugin.toRequest === 'function')
				plugin = plugin.toRequest(req);

			nPlugins.add(plugin);
		}

		return nPlugins;
	}

	/**
	 * @hidden
	 */
	z_loadGlobalData(cr: CrelteRequest): (Promise<void> | void | undefined)[] {
		return Array.from(this.plugins.values()).map(plugin =>
			plugin.loadGlobalData?.(cr),
		);
	}

	/**
	 * @hidden
	 */
	z_loadData(cr: CrelteRequest): (Promise<void> | void | undefined)[] {
		return Array.from(this.plugins.values()).map(plugin =>
			plugin.loadData?.(cr),
		);
	}

	/**
	 * @hidden
	 */
	z_render(cr: CrelteRequest, route: Route): void {
		for (const plugin of this.plugins.values()) {
			plugin.render?.(cr, route);
		}
	}
}
