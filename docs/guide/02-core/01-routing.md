# Routing

Routing in Crelte is split into two parts.

First crelte determines which [site](https://craftcms.com/docs/5.x/system/sites.html) the request belongs to. The uri is then submitted to craft via the `entry.graphql` where craft will determine the correct entry and language.

Based on the `sectionHandle` and `typeHandle` a template get's selected which get's passed to the `App.svelte` which will then render it.

## Basic App.svelte

```svelte
<script context="module">
	export const templates = import.meta.glob('@/templates/*.svelte');
</script>

<script>
	export let entry;
	export let template;
	export let templateData;
</script>

<!-- update entire template if the entry changes -->
{#key entry}
	<svelte:component this={template} {entry} {...templateData} />
{/key}
```
