import fs from 'fs/promises';
import command from 'node:child_process';
import util from 'node:util';

const exec = util.promisify(command.exec);

export type BuildOptions = {
	ts?: boolean;
};

export async function build(opts: BuildOptions = {}) {
	const fileExtension = opts.ts ? 'ts' : 'js';

	console.info('build client');
	await exec('npx vite build --outDir .dist/client --ssrManifest');

	console.info('build server');
	await exec(
		'npx vite build --outDir .dist/server --ssr src/server.' +
			fileExtension,
	);

	console.info('create dist');
	try {
		await fs.rm('dist', { force: true, recursive: true });
	} catch (e) {}
	await fs.mkdir('dist');

	await fs.cp('.dist/server/', 'dist/', { recursive: true });

	await fs.cp('.dist/client/', 'dist/public/', { recursive: true });
	await fs.rename('dist/public/index.html', 'dist/index.html');
	await fs.rename(
		'dist/public/.vite/ssr-manifest.json',
		'dist/ssr-manifest.json',
	);

	try {
		await fs.rm('dist/public/.vite', { force: true, recursive: true });
	} catch (e) {}
	try {
		await fs.rm('.dist', { force: true, recursive: true });
	} catch (e) {}

	console.info('build done 🎉 ready to launch 🚀');
}
