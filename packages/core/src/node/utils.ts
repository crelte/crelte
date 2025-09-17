import { Readable } from 'node:stream';
import fs from 'node:fs/promises';
import npath from 'node:path';
import * as http from 'node:http';
import { Platform } from '../server/platform.js';

export async function readFile(path: string): Promise<string> {
	// maybe not necessary
	return await fs.readFile(path, 'utf-8');
}

export async function writeFile(path: string, data: string): Promise<void> {
	await fs.writeFile(path, data, 'utf-8');
}

export const PLATFORM: Platform = {
	joinPath: (...paths) => npath.join(...paths),
	readFile,
	writeFile,
	mkdir: (path, opts) => fs.mkdir(path, opts) as Promise<void>,
	rm: (path, opts) => fs.rm(path, opts),
};

export function requestToWebRequest(
	baseUrl: string,
	nodeReq: http.IncomingMessage,
): Request {
	const method = nodeReq.method ?? 'GET';

	let body;
	if (method !== 'GET' && method !== 'HEAD') {
		body = Readable.toWeb(nodeReq) as BodyInit;
	}

	const url = baseUrl + ((nodeReq as any).originalUrl ?? nodeReq.url);

	// 4. Construct a new Request
	return new Request(url, {
		// we need this to be able to listen on the request body
		// @ts-ignore
		duplex: 'half',
		method,
		headers: nodeReq.headers as Record<string, string>,
		body,
	});
}

export async function webResponseToResponse(
	webResponse: Response,
	nodeRes: http.ServerResponse,
): Promise<void> {
	nodeRes.statusCode = webResponse.status;
	nodeRes.statusMessage = webResponse.statusText || '';

	for (const [key, value] of webResponse.headers.entries()) {
		nodeRes.setHeader(key, value);
	}

	if (!webResponse.body) {
		nodeRes.end();
		return;
	}

	const nodeStream = Readable.fromWeb(webResponse.body as any);
	nodeStream.pipe(nodeRes);

	nodeStream.on('error', err => {
		nodeRes.destroy(err);
	});
}
