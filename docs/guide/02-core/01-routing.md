
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
- `blog.svelte` → section `blog` with a single entry type

If no matching template is found, an error is thrown during rendering.

### Error templates

- `error-404.svelte` is rendered when no entry can be resolved for a request.
- `Error.svelte` is rendered when an error occurs during routing or rendering, or when Craft is in maintenance mode.

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
