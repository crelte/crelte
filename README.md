# Crelte


consolidating features
- entryRoutes
- plugin events


- documenting them


## Reworking the router

// only exposes public properties
// all internal types rely on the InnerRouter
// maybe the current InnerRouter should be renamed to DomRouter or something

// a request should contain the entry if already fetched
Router {

}


## Allowing for custom graphql functions
- would allow to define loading data from a custom api instead of only graphql
- allow the plugin system to handle better language redirects





## Svelte 5.0

<script context="module">
	export const templates = import.meta.glob('@/templates/*.svelte');

	/** @type {import('crelte').Config} */
	export const config = {
		preloadOnMouseOver: true,
	};
</script>

<script>
	import Footer from './components/Footer.svelte';
	import Header from './components/Header.svelte';

	const { props: pops } = $props();

	const entry = $derived($pops.entry);
	const Template = $derived($pops.template);
	const templateData = $derived($pops.templateData);
</script>

<!-- update entire component if page changes -->
{#key entry}
	<div class="app">
		<Template {entry} {...templateData} />
	</div>
{/key}
