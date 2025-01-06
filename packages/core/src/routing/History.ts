export default interface History {
	scrollY(): number;
	replaceState(data: any, url?: string): void;
	pushState(data: any, url: string): void;
	open(url: string): void;
}

export class ClientHistory implements History {
	scrollY(): number {
		return window.scrollY;
	}

	replaceState(data: any, url?: string): void {
		history.replaceState(data, '', url);
	}

	pushState(data: any, url: string): void {
		history.pushState(data, '', url);
	}

	open(url: string): void {
		window.location.href = url;
	}
}

export class ServerHistory implements History {
	state: any | null;
	url: string | null;

	constructor() {
		this.state = null;
		this.url = null;
	}

	scrollY(): number {
		return 0;
	}

	replaceState(data: any, url?: string): void {
		this.state = data;
		this.url = url ?? null;
	}

	pushState(data: any, url: string): void {
		this.state = data;
		this.url = url;
	}

	open(url: string): void {
		this.url = url;
	}
}
