# Styling
Svelte has great support for styling. Because you can write css directly
in your component and it is scoped to those elements.


## :global
This has the downside that nested components or elements within `{@html text}` wont
work.

For this there is the `:global` selector.

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
	let { href, title, active } = $props();
</script>

<a {href} class="nav" class:active>
	{title}
</a>
```

## Global CSS
By default you have two scss files.

### src/sass/vars.scss

This file is included in all components and should only
contain sass variables (else code is duplicated).

### src/sass/main.scss

This is the main file where you can style stuff globally like
the body or some css variables.

**Note**: We recommend to write most styling into components
this makes each component better reusable and easier to maintain.

## Body class
When you have some global style or theme which should should be applied as high
as possible in the dom, you can use `bodyClass`. This will set classes on the
body element during ssr and also later via a store.

The simplest way to do this is globally inside a `loadEntryData` function.

### Example `App.svelte`

```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadEntryData = ({ bodyClass }, entry) => {
		// this will apply the dark-theme class to the body when
		// the current entry is a blog entry
		bodyClass.toggle('dark-theme', entry.typeHandle === 'blog');
	};
</script>
```
