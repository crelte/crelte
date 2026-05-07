import SsrCache from '../ssr/SsrCache.js';

export type HistoryClassSet = {
	add(cls: string): void;
	remove(cls: string): void;
	setVariant(variant: string, cls: string | null): void;
};

export class ClassSet {
	private _classes: Set<string>;
	/** @hidden */
	z_variants: Variants;
	private history: ((cl: HistoryClassSet) => void)[] | null;

	constructor(
		classes?: Iterable<string>,
		variants?: Iterable<[string, string]>,
		history: boolean = false,
	) {
		this._classes = new Set(classes);
		this.z_variants = new Variants();
		this.history = history ? [] : null;
	}

	classes(): Iterable<string> {
		return this._classes;
	}

	get length(): number {
		return this._classes.size;
	}

	has(cls: string): boolean {
		return this._classes.has(cls);
	}

	add(cls: string): void {
		this._classes.add(cls);
		if (this.history) this.history.push(c => c.add(cls));
	}

	delete(cls: string): void {
		this._classes.delete(cls);
		if (this.history) this.history.push(c => c.remove(cls));
	}

	/**
	 * @returns Returns true if the value was changed
	 */
	setVariant(variant: string, cls: string | null): boolean {
		const { remove, add } = this.z_variants.set(variant, cls);

		if (remove) this.delete(remove);
		if (add) this.add(add);

		const changed = !!remove || !!add;

		if (this.history) this.history.push(c => c.setVariant(variant, cls));

		return changed;
	}

	/**
	 * Fails if no history is active.
	 */
	applyHistory(cl: HistoryClassSet): void {
		this.history!.forEach(fn => fn(cl));
	}
}

export type VariantSetReturn = {
	remove?: string;
	add?: string;
};

export class Variants {
	// list of active variant classes
	private inner: Map<string, string>;

	constructor(entries?: Iterable<[string, string]>) {
		this.inner = new Map(entries);
	}

	set(variant: string, cls: string | null): VariantSetReturn {
		const current = this.inner.get(variant) ?? null;

		if (current === cls) return {};

		const obj: VariantSetReturn = {};

		if (current) obj.remove = current;
		if (cls) {
			obj.add = cls;
			this.inner.set(variant, cls);
		} else {
			this.inner.delete(variant);
		}

		return obj;
	}

	entries(): Iterable<[string, string]> {
		return this.inner.entries();
	}
}

// separate function for tree shaking
export function ssrCacheToVariants(ssrCache: SsrCache): Variants {
	return new Variants(ssrCache.get('BODY_CLASS_VAR')!);
}

// separate function for tree shaking
export function variantsToSsrCache(
	variants: Variants,
	ssrCache: SsrCache,
): void {
	ssrCache.set('BODY_CLASS_VAR', Array.from(variants.entries()));
}
