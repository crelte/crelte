
# Routing

Routing in Crelte is driven by Craft CMS. Instead of defining routes manually in the frontend, Crelte uses Craft’s site, section, and entry configuration to determine which content and template should be rendered for a given request.

## Routing flow

Routing happens in three steps:

1. **Site and entry resolution**  
   When a request comes in, Crelte determines which Craft site the URL belongs to. The remaining URI is then submitted to Craft via GraphQL, where Craft resolves the correct entry and language based on its routing and localization rules.

2. **Template resolution**  
   Once an entry is resolved, Crelte selects a Svelte template based on the entry’s section and entry type. This mapping follows a simple naming convention and allows templates to directly reflect Craft’s content structure.

3. **Rendering**  
   The resolved entry, template, and loaded data are passed to the application root and rendered using server-side rendering with client-side hydration.

## Template resolution

Templates live in the `svelte/src/templates` directory.  
Crelte resolves templates using the following naming rules:

- `<section-handle>-<entry-type>.svelte`
- `<section-handle>.svelte` (if the section has only one entry type)

Examples:

- `blog-post.svelte` → section `blog`, entry type `post`
- `blog.svelte` → section `blog` with any entry type

If no matching template is found, an error is thrown during rendering.

### Error templates

- `error-404.svelte` is rendered when no entry can be resolved for a request.

:::tip Unknown error
If an error occured like craft is not accessible or some svelte error, the [src/Error.svelte](#error-svelte) is rendered.
:::

## App.svelte

The `App.svelte` component is responsible for rendering the resolved template. It receives routing information and dynamically loads the appropriate Svelte component.

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

{#key entry}
	<div class="app">
		<Template {entry} {...templateData} />
	</div>
{/key}
```

- `entry` contains the resolved Craft entry
- `Template` is the selected Svelte template
- `templateData` contains data loaded during routing and template execution

Using a keyed block ensures the entire page is re-rendered when navigating between entries.

## Preloading

There is a config you can enable, which will preload links on hover to speed up navigation.

`App.svelte`
```svelte
<script module>
	/** @type {import('crelte').Config} */
	export const config = {
		preloadOnMouseOver: true,
	};
</script>
```

With this enabled all links will be preloaded on hover, to disable some links you can add
the attribute `data-no-preload` to the anchor tag.

Alternatively you can also use the [Router.preload](/types/routing/classes/Router.html#preload)
method to preload links programmatically.

## Error.svelte

The `Error.svelte` component handles error states and is decoupled from the normal
rendering.

To style the `Error.svelte` component you can add `export const debugError = true;` to
`src/server.js`. If you wan't to have a specific status returned set it via
`export const errorStatus = 503;`.
