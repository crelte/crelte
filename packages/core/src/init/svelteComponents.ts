import {
	internalSvelteMount,
	internalSvelteRender,
} from 'crelte-vite-plugin/svelteComponents.js';

export function svelteMount(comp: any, options: any): any {
	return internalSvelteMount(comp, options);
}

export function svelteRender(comp: any, options: any): any {
	return internalSvelteRender(comp, options);
}
