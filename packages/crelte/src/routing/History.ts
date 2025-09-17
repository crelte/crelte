import Request from './route/Request.js';

export default interface History {
	scrollY(): number | null;
	replaceState(data: any, url?: string): void;
	pushState(data: any, url: string): void;
	open(req: Request): void;
	back(): void;
}

export class ClientHistory implements History {
	scrollY(): number | null {
		return window.scrollY;
	}

	replaceState(data: any, url?: string): void {
		history.replaceState(data, '', url);
	}

	pushState(data: any, url: string): void {
		history.pushState(data, '', url);
	}

	open(req: Request): void {
		window.location.href = req.url.href;
	}

	back(): void {
		window.history.back();
	}
}

export class ServerHistory implements History {
	state: any | null;
	url: string | null;
	req: Request | null;

	constructor() {
		this.state = null;
		this.url = null;
		this.req = null;
	}

	scrollY(): number | null {
		return null;
	}

	replaceState(data: any, url?: string): void {
		this.state = data;
		this.url = url ?? null;
		this.req = null;
	}

	pushState(data: any, url: string): void {
		this.state = data;
		this.url = url;
		this.req = null;
	}

	open(req: Request): void {
		this.req = req;
		this.url = null;
	}

	back(): void {
		throw new Error('Cannot go back on the server');
	}
}
