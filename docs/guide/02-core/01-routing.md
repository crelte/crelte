# Routing

Routing in Crelte is split into two parts.

First crelte determines which [site](https://craftcms.com/docs/5.x/system/sites.html) the request belongs to. The uri is then submitted to craft via the `entry.graphql` where craft will determine the correct entry and language.

Based on the `sectionHandle` and `typeHandle` a template get's selected which get's passed to the `App.svelte` which will then render it.

## Basic App.svelte

```svelte
<script module>
	export const templates = import.meta.glob('@/templates/*.svelte');
</script>

<script>
	let { route } = $props();

	let entry = $derived($route.entry);
	let Template = $derived($route.template.default);
	let templateData = $derived($route.loadedData);
</script>

<!-- update entire component if page changes -->
{#key entry}
	<div class="app">
		<Template {entry} {...templateData} />
	</div>
{/key}
```
