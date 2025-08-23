# Crelte


consolidating features
- entryRoutes
- plugin events


- documenting them


## Reworking the router

1. request comes in (build a request from url and state or headers).
- site is determined or a default one is used
2. > trigger event onRequestStart
3. if the request does not have a matching site, redirect to the site
   matching the acceptLang
4. loadGlobalData (in parallel with 5-7)
- call app.loadGlobalData (filling the returned data into the globals)
> trigger event loadGlobalData
5(?) or have a static router included?, router.add
5. loadEntry (in parallel with 4)
- call app.loadEntry (this might return null or an entry)
  if you pass a graphql query it automatically calls queryEntry
// in most cases the utility function queryEntry(cr, entryQuery) should be
  used (or this, so everybody knows this function)
// if you wan't to have static routes, create a static router and use
// that in loadEntry
6. afterLoadEntry (in parallel with 4)
> trigger event afterLoadEntry
7. loadTemplate (in parallel with 4)
- use from app.templates
8. loadEntryData (before the entry and the template where added to the request)
- call app.loadEntryData (if defined)
- call template.loadData (if defined)
> trigger loadData

9. convert to Route
10. render
- route notify
- site notify
- entry notify
- onRoute
- globalsUpdate
- beforeRender


// Base Router
- targetToRequest

// Server Router (contains InternalRouter)

// Client Router (contains InternalRouter)

// Router (the public class)


// GlobalsCreator?

// RequestGlobals

// Globals



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
