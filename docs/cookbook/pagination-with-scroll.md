# Pagination with scroll to

This is is an example where after the pagination is changed
we want to scroll to the top of the list.

To archieve this we leverage creltes data attributes and an event.

`App.svelte`:
```svelte
<script module>
	// this should be in a plugin or in the app.init function
	export function init(crelte) {
		// todo onRequest we could also already disable the scroll
		// so the attribute data-disable-scroll does not need to be added
		
		// after render gets excuted once the new dom was rendered
		crelte.events.on('afterRender', (cr, route) => {
			// all data-* are stored inside the context
			const scrollTo = route.getContext('scrollTo');
			if (scrollTo) {
				const el = document.querySelector(scrollTo);
				el?.scrollIntoView({ behavior: 'smooth' });
			}
		});
	}
</script>
```

`PaginatedList.svelte`:
```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadData = ({ req }) => {
		const page = parseInt(req.getSearchParam('page')) || 0;
		
		// this could of course also be a query
		const content = Array(10).fill(0).map((_, i) => `Item ${page * 10 + i}`);
		
		return { page, content };
	};
</script>

<script>
	import { getRoute } from 'crelte';
	
	let { page, content } = $props();
	
	function paginatedUrl(route, page) {
		route.setSearchParam('page', page > 0 ? page : null);
		return route.url;
	}
</script>

<div id="list">
	{#each content as item}
		<div class="item">{item}</div>
	{/each}
</div>

<div class="navigation">
	{#if page > 0}
		<a
			href={paginatedUrl($route, page - 1)}
			data-disable-scroll
			data-scroll-to="#list"
		>Previous page</a>
	{/if}
	<a
		href={paginatedUrl($route, page + 1)}
		data-disable-scroll
		data-scroll-to="#list"
	>Next page</a>
</div>

<style lang="scss">
	.item {
		min-height: 20vh;
	}
</style>
```
