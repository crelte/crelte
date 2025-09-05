import fs from 'node:fs/promises';
import npath from 'node:path';
import Router from '../Router.js';
import CrelteServerRequest from '../CrelteServer.js';
import { newError } from './routes.js';

export default class QueriesCaching {
	private cacheDir: string | null;
	private validBearerToken: string | null;
	router: Router;

	constructor(cs: Router) {
		this.router = cs;

		const enableCaching = !!cs.getEnv('FRONTEND_FROM_CRAFT_URL');
		const endpointToken = cs.getEnv('ENDPOINT_TOKEN');
		if (enableCaching) {
			if (!endpointToken)
				throw new Error(
					'if caching is enabled you need to specify an ENDPOINT_TOKEN',
				);

			// todo maybe this should be configurable
			this.cacheDir = 'queries-cache';
			this.validBearerToken = 'Bearer ' + endpointToken;
		} else {
			this.cacheDir = null;
			this.validBearerToken = null;
		}

		if (enableCaching)
			cs.post('/queries/webhook', csr => this.handleWebhook(csr));
	}

	async getCache<T = any>(key: string): Promise<T | null> {
		if (!this.cacheDir) return null;

		const path = npath.join(this.cacheDir, key + '.json');
		let str: string;
		try {
			str = await fs.readFile(path, 'utf-8');
		} catch (_e) {
			return null;
		}

		try {
			return JSON.parse(str);
		} catch (_e) {
			console.error(`could not parse '${path}' as json`);
		}

		return null;
	}

	async setCache<T>(key: string, data: T): Promise<void> {
		if (!this.cacheDir) return;

		const path = npath.join(this.cacheDir, key + '.json');

		await fs.mkdir(this.cacheDir, { recursive: true });

		await fs.writeFile(path, JSON.stringify(data), 'utf-8');
	}

	/// only call this if caching is enabled
	private async handleWebhook(csr: CrelteServerRequest): Promise<Response> {
		const bearerToken = csr.req.headers.get('Authorization');
		if (bearerToken !== this.validBearerToken)
			return newError('unauthorized', 401);

		try {
			await fs.rm(this.cacheDir!, { recursive: true, force: true });
		} catch (_e) {
			//
		}

		return new Response('ok');
	}
}
