# Styling

Svelte has great support for styling. You can write css directly in your component and it is scoped to those elements.

## :global

One downside of this scoped styling is that nested components or elements within `{@html text}` wont work.

To style those elements, use the `:global` selector.

```svelte
<script>
	let text = '<p><strong>Test</strong></p>';
</script>

<div class="rt">{@html text}</div>

<style lang="scss">
	.rt :global {
		strong {
			font-weight: 500;
		}
	}

	// or
	.rt :global(p) {
		margin-bottom: 0.5rem;
	}
</style>
```

## Classes

Toggeling classes is really easy and short.

```svelte
<script>
    // the prop `active` returns `true` or `false`
	let { href, title, active } = $props();
</script>

<a {href} class="nav" class:active>
	{title}
</a>
```

## Global CSS

By default you have two scss files:

### src/sass/vars.scss

This file is included in all components and should only
contain sass variables (otherwise code is duplicated).

### src/sass/main.scss

This is the main file where you can style stuff globally like
the body or some css variables.

**Note**: We recommend to write most styling into components as this makes each component easier to reuse and maintain.

## Body class

When you have some global style or theme which should be applied as high
as possible in the DOM, you can use `bodyClass`. This will set classes on the
body element during the server side rendering (SSR) and also later via a store.

The simplest way to do this is globally inside a `loadEntryData` function.

### Example `App.svelte`

```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadEntryData = ({ bodyClass }, entry) => {
		// this will apply the dark-theme class to the body when
		// the current entry is a blog entry
		bodyClass.toggle('dark-theme', entry.typeHandle === 'blog');

		// or if you want to style something based on the section
		bodyClass.setVariant('section', 'section-' + entry.sectionHandle);
	};
</script>
```
