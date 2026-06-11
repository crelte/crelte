# Preload on hover

This allows for Crelte to preload data as soon as a user hovers over a link, resulting in a much faster user experience.

If you want to preload all links on hover, please [check the docs](/docs/02-core/01-routing.md#preloading).

If you only want to preload specific links on hover, you can use the following Svelte action:

```ts
import { getRouter } from 'crelte';

/**
 * This a Svelte action
 * just add it to an a element which should preload on mouseover
 *
 * `{@attach preloadOnMouseOver}`
 */
export default function preloadOnMouseOver(el: HTMLAnchorElement) {
	const router = getRouter();

	const evListener = () => {
		router.preload(el.href);
		el.removeEventListener('mouseover', evListener);
	};

	el.addEventListener('mouseover', evListener, { once: true });

	return () => {
		el.removeEventListener('mouseover', evListener);
	};
}
```
