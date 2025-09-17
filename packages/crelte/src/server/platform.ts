export type Platform = {
	joinPath: (...paths: string[]) => string;
	// always utf8
	readFile: (path: string) => Promise<string>;
	// always utf8
	writeFile: (path: string, data: string) => Promise<void>;
	mkdir: (path: string, opts?: { recursive?: boolean }) => Promise<void>;
	rm: (
		path: string,
		opts?: { recursive?: boolean; force?: boolean },
	) => Promise<void>;
};
