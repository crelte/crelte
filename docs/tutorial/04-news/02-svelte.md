# Svelte news

At the moment if you open the news page. You should get the following error in the console `Template not found: <pages-news>`.

To fix that let's create a new file `svelte/src/templates/pages-news.svelte` with the following content:
```svelte
<script context="module">
	import articlesQuery from '@/queries/articles.graphql';

	// this will execute the query
	export const loadData = articlesQuery;
</script>

<script>
	export let articles;
</script>

{#each articles as article}
{/each}
```
