# Crelte

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
