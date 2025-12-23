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
