import { relative } from 'path';
import MagicString from 'magic-string';

// todo need to replace this
export function usedSsrComponents(dirname: string) {
	if (!dirname) throw new Error('expected dirname in usedSsrComponents');

	return {
		transform(code: string, id: string, options: any) {
			if (!options?.ssr || !id.endsWith('.svelte')) return;

			const file = relative(dirname, id);

			const initFnSign =
				'create_ssr_component(($$result, $$props, $$bindings, slots) => {';
			let idx = code.indexOf(initFnSign);
			if (idx < 0) return;
			idx += initFnSign.length;

			const s = new MagicString(code);

			s.prepend(
				`import { getContext as __modulesGetContext } from 'svelte';\n`,
			);

			const ctxAdd = `
(() => {
const ctx = __modulesGetContext('modules');
if (ctx && ctx instanceof Set) {
	ctx.add('${file}');
}
})();
`;
			s.appendLeft(idx, ctxAdd);

			return {
				map: s.generateMap({
					source: id,
					includeContent: true,
					hires: 'boundary',
				}),
				code: s.toString(),
			};
		},
	};
}

// transform graphql files into a GraphQlQuery which can called with
// crelte.query or graphQl.query
//
// See: https://craftcms.com/docs/4.x/graphql.html#specifying-variables
export function graphQlFiles() {
	return {
		transform: async (code: string, path: string) => {
			if (!path.endsWith('.graphql')) return;

			const json = JSON.stringify(code)
				.replace(/\u2028/g, '\\u2028')
				.replace(/\u2029/g, '\\u2029');

			return `
export default {
	path: ${JSON.stringify(path)},
	query: ${json},
};
`;
		},
	};
}
