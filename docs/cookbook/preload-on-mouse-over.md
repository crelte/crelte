# Preload on hover

If you only want to preload specific links on hover, you can use the following Svelte action:

```ts
import { getRouter } from 'crelte';

/**
 * This a svelte action
 * just add it to an a element which should preload on mouseover
 *
 * `use:preloadOnMouseOver`
 */
export default function preloadOnMouseOver(el: HTMLAnchorElement) {
	const router = getRouter();

	const evListener = () => {
		router.preload(el.href);
		el.removeEventListener('mouseover', evListener);
	};

	el.addEventListener('mouseover', evListener, { once: true });

	return {
		destroy: () => {
			el.removeEventListener('mouseover', evListener);
		},
	};
}
```
