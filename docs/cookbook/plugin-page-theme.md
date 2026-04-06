# Page Theme Plugin

This is a plugin which stores the theme of the page based on the typeHandle.

To archieve this we use the StagedWritable store which allows us to have a
"staging" area for the new theme value which then gets commited in the 
render phase.

`lib/pageTheme.ts`
```ts
import { getCrelte, type Crelte, type CrelteRequest } from 'crelte';
import type { Plugin, PluginCreator } from 'crelte/plugins';
import type { Request, Route } from 'crelte/routing';
import { StagedWritable } from 'crelte/std/stores';

export function createPageTheme(): PluginCreator {
	return _crelte => new PageThemePlugin();
}

export function getPageTheme(crelte?: Crelte): PageThemePlugin {
	crelte = crelte ?? getCrelte();
	return crelte.getPlugin('pageTheme') as PageThemePlugin;
}

export type PageTheme = 'color1' | 'color2' | 'color3';

export class PageThemePlugin implements Plugin {
	store: StagedWritable<PageTheme>;

	constructor(store?: StagedWritable<PageTheme>) {
		// by default we set color1 even tought that value will only be
		// visible in the first loadData call but never in a store read
		this.store = store ?? new StagedWritable('color1');
	}

	get name(): string {
		return 'pageTheme';
	}

	/**
	 * Subscribe to changes of the theme, for example in a component
	 */
	subscribe(
		fn: (val: PageTheme) => void,
		invalidate?: () => void,
	): () => void {
		return this.store.subscribe(fn, invalidate);
	}

	/**
	 * Get the current theme, if you don't need it to be reactive
	 */
	get(): PageTheme {
		// todo, maybe StagedWritable shoud have a getAsync like Globals has
		// so the plugin could expose a similar api, because at the loadData
		// call from a block or a template its not a give that this is
		// available
		return this.store.get();
	}

	toRequest(_req: Request): PageThemePlugin {
		// create a new instance of the plugin for the request
		// allowing requests to happen in parallel and the newest one to
		// "win"
		return new PageThemePlugin(this.store.stage());
	}

	loadData(cr: CrelteRequest) {
		// in loadData entry is already defined
		const entryType = cr.req.entry!.typeHandle;

		console.log('entryType', entryType);

		let newColor: PageTheme = this.store.get();
		switch (entryType) {
			case 'blog':
				newColor = 'color2';
				break;
			case 'project':
				newColor = 'color3';
				break;
			// default color is color 1
			default:
				newColor = 'color1';
		}

		// only change the color if it is different
		if (newColor !== this.store.get()) {
			this.store.set(newColor);
		}
	}

	render(_cr: CrelteRequest, _route: Route): void {
		// update the store to the new value
		this.store.commit();
	}
}
```
