# Static router

Sometimes not all pages can resolved by craft. Maybe you have some pages which come from an external
source or similar.

For these cases the staticRoute plugin exists.

## Installation

```svelte
<script module>
	import { createStaticRouter, getStaticRouter } from 'crelte/static';
	import { ENTRY_ERROR_404 } from 'crelte/loadData';
	
	export const plugins = [
		createStaticRouter()
	];
	
	/** @type {import('crelte').Init} */
	export function init(crelte) {
		const router = getStaticRouter(crelte);

		router.add('/external/:id', async csr => {
			const resource = await loadExternalResource(csr.getParam('id'));
			if (!resource) return ENTRY_ERROR_404;
			
			// you need to return a valid Entry
			return {
				sectionHandle: 'external',
				typeHandle: 'external',
				...resource
			};
		});
	}
</script>
```

The static router internally uses the [loadEntry](/guide/03-advanced/02-plugins.html#loadentry) event
and can therefore override / prevent `entry.graphql` being executed.
And since you need to return a valid Entry object everything else will work as usual.
