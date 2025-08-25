import { relative } from 'node:path';
import MagicString from 'magic-string';
import {
	ConfigEnv,
	Plugin,
	ResolvedConfig,
	TransformResult,
	UserConfig,
	build as viteBuild,
	ViteDevServer,
} from 'vite';
import fs from 'node:fs/promises';
import {
	EnvData,
	initEnvData,
	modRender,
	modRenderError,
	requestToWebRequest,
	webResponseToResponse,
} from './server.js';
import Router from './Router.js';
import sveltePackage from 'svelte/package.json' with { type: 'json' };

const VIRT_MOD_ID = 'virtual:crelte/svelteComponents';
const RESOLVED_VIRT_MOD_ID = '\0' + VIRT_MOD_ID;

async function readFile(path: string): Promise<string> {
	// maybe not necessary
	return await fs.readFile(path, 'utf-8');
}

// todo need to find a better solution
// for reference https://github.com/sveltejs/svelte/issues/4854
// and https://github.com/sveltejs/svelte/pull/5476
function usedSsrComponents(
	code: string,
	id: string,
	options: { ssr?: boolean } | undefined,
	svelte5: boolean,
): TransformResult | undefined {
	if (!options?.ssr || !id.endsWith('.svelte')) return;

	const file = relative('.', id);

	let idx;
	if (svelte5) {
		// this will not catch all cases, but it should be enough
		// since almost all components will have props
		const initFnSign = '($$payload, $$props) {';
		idx = code.indexOf(initFnSign);
		if (idx < 0) return;

		const pushSign = '$.push(';
		idx = code.indexOf(pushSign, idx);
		if (idx < 0) return;

		// Find the end of the line where the pattern was found
		idx = code.indexOf('\n', idx);
		if (idx < 0) return;
		idx += 1; // \n
	} else {
		const initFnSign =
			'create_ssr_component(($$result, $$props, $$bindings, slots) => {';
		idx = code.indexOf(initFnSign);
		if (idx < 0) return;
		idx += initFnSign.length;
	}

	const s = new MagicString(code);

	s.prepend(`import { getContext as __modulesGetContext } from 'svelte';\n`);

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
}

// transform graphql files into a GraphQlQuery which can called with
// crelte.query or graphQl.query
//
// See: https://craftcms.com/docs/4.x/graphql.html#specifying-variables
function graphQlFiles(
	code: string,
	path: string,
): TransformResult | string | undefined {
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
}

function isSvelte5(): boolean {
	if (sveltePackage && sveltePackage.version) {
		console.log('sveltepackage', sveltePackage.version);
		return sveltePackage.version.startsWith('5.');
	}
	// Fallback or error handling if version cannot be determined
	console.warn('Could not determine Svelte version. Assuming not Svelte 5.');
	return false;
}

// outside of crelte because each build executes crelte again
let isSsrBuild = false;

export type CrelteOptions = {
	/** If not specified tries to detect which version is installed */
	svelte4?: boolean;
};

export default function crelte(opts?: CrelteOptions): Plugin {
	let viteConfig: ResolvedConfig;
	let viteConfigEnv: ConfigEnv;
	let initialConfig: UserConfig;

	const svelte5 = opts?.svelte4 ? false : isSvelte5();

	return {
		name: 'crelte',

		config(config, configEnv) {
			initialConfig = config;
			viteConfigEnv = configEnv;

			const isBuild = configEnv.command === 'build';

			const nConfig: any = {
				publicDir: isSsrBuild ? false : 'public',
				base: '/',
				server: {
					port: 8080,
				},
				ssr: {
					// embedd all our packages
					// this ensure that if you wan't you could deploy the dist folder
					// without the need for anything else
					noExternal: ['crelte-std', 'crelte', 'crelte-node'],
				},
			};

			if (isBuild) {
				if (!nConfig.build) nConfig.build = {};
				nConfig.build.ssr = isSsrBuild ? './src/serverNode.js' : false;
				nConfig.build.ssrManifest = !isSsrBuild;
				nConfig.build.outDir = isSsrBuild
					? '.dist/server'
					: '.dist/client';
			}

			return nConfig;
		},

		configResolved(resolvedConfig) {
			viteConfig = resolvedConfig;
		},

		resolveId(id) {
			if (id.endsWith('/src/serverNode.js')) {
				return id;
			}

			if (id === VIRT_MOD_ID) {
				return RESOLVED_VIRT_MOD_ID;
			}
		},

		load(id) {
			if (id.endsWith('/src/serverNode.js')) {
				return (
					`import * as server from './server.js';` +
					`import createServer from 'crelte-node/node';` +
					`createServer(server, ${Date.now()});`
				);
			}

			if (id === RESOLVED_VIRT_MOD_ID) {
				if (svelte5) {
					return (
						`import { hydrate } from 'svelte';` +
						`import { render } from 'svelte/server';` +
						`export function internalSvelteMount(comp, options) {` +
						`hydrate(comp, options);` +
						`}` +
						`export function internalSvelteRender(comp, options) {` +
						`return render(comp, options);` +
						`}`
					);
				} else {
					return (
						`export function internalSvelteMount(comp, options) {` +
						`return new comp({ ...options, hydrate: true });` +
						`}` +
						`export function internalSvelteRender(comp, options) {` +
						`return comp.render(options.props, options);` +
						`}`
					);
				}
			}
		},

		transform(code, id, options) {
			return (
				usedSsrComponents(code, id, options, svelte5) ||
				graphQlFiles(code, id)
			);
		},

		async configureServer(vite) {
			const env = await initEnvData();

			return () => {
				serveVite(env, vite);
			};
		},

		// run the ssr build after the client build
		writeBundle: {
			sequential: true,
			async handler(_options) {
				if (isSsrBuild) return;

				isSsrBuild = true;

				await viteBuild({
					configFile: viteConfig.configFile,
					// cli args
					mode: viteConfigEnv.mode,
					logLevel: viteConfig.logLevel,
					clearScreen: viteConfig.clearScreen,
					build: {
						minify: initialConfig.build?.minify,
						assetsInlineLimit: viteConfig.build.assetsInlineLimit,
						sourcemap: viteConfig.build.sourcemap,
					},
					optimizeDeps: {
						force: viteConfig.optimizeDeps.force,
					},
				});

				// after both builds we need to delete .dist
				// and move everything to dist
				try {
					await fs.rm('dist', { force: true, recursive: true });
				} catch (_e) {
					// empty
				}
				await fs.mkdir('dist');

				await fs.cp('.dist/server/', 'dist/', { recursive: true });

				await fs.cp('.dist/client/', 'dist/public/', {
					recursive: true,
				});
				await fs.rename('dist/public/index.html', 'dist/index.html');
				await fs.rename(
					'dist/public/.vite/ssr-manifest.json',
					'dist/ssr-manifest.json',
				);

				try {
					await fs.rm('dist/public/.vite', {
						force: true,
						recursive: true,
					});
				} catch (_e) {
					// empty
				}

				try {
					await fs.rm('.dist', { force: true, recursive: true });
				} catch (_e) {
					// empty
				}
			},
		},
	};
}

async function serveVite(env: EnvData, vite: ViteDevServer) {
	vite.middlewares.use(async (nReq, res, next) => {
		const protocol = vite.config.server.https ? 'https' : 'http';
		const baseUrl = protocol + '://' + nReq.headers['host'];

		const req = requestToWebRequest(baseUrl, nReq);

		let thrownError: any = null;

		let serverMod;
		try {
			serverMod = await vite.ssrLoadModule('./src/server.js', {
				fixStacktrace: true,
			});
		} catch (e: any) {
			next(e);
			return;
		}

		if (typeof serverMod.routes === 'function') {
			// check if a route matches (todo can i move this out of the middleware?)
			const router = new Router(env.endpointUrl, env.env, env.sites);

			await serverMod.routes(router);

			try {
				const response = await router._handle(req);
				if (response) {
					await webResponseToResponse(response, res);
					return;
				}
			} catch (e: any) {
				vite.ssrFixStacktrace(e);
				next(e);
				return;
			}
		}

		let template = await readFile('./index.html');
		template = await vite.transformIndexHtml(
			nReq.originalUrl ?? '',
			template,
		);

		try {
			const response = await modRender(env, serverMod, template, req);
			await webResponseToResponse(response, res);
			return;
		} catch (e: any) {
			vite.ssrFixStacktrace(e);

			if (typeof serverMod.renderError !== 'function') return next(e);

			thrownError = e;
		}

		try {
			const response = await modRenderError(
				env,
				serverMod,
				thrownError,
				template,
				req,
			);
			await webResponseToResponse(response, res);
			return;
		} catch (e) {
			next(e);
		}
	});
}
