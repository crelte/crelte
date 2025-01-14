import CrelteCore from '../Crelte.js';

export interface Plugin {
	name: string;
}

export type PluginCreator = (crelte: CrelteCore) => Plugin;

export default class Plugins {
	plugins: Map<string, Plugin>;

	constructor() {
		this.plugins = new Map();
	}

	add(plugin: Plugin) {
		this.plugins.set(plugin.name, plugin);
	}

	get(name: string): Plugin | null {
		return this.plugins.get(name) ?? null;
	}
}
