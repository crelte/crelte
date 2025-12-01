import { Crelte } from '../crelte.js';

/**
 * A plugin
 */
export interface Plugin {
	name: string;
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
}
