# State management

State management is hard. Fortunately most website dont have that many states
and a lot of those states are already covered by crelte.

Here are a few gotchas and tips to keep in mind when building a website.

### No global variables
Dont store state which changes in a global variable. This can lead to a lot of weird
bugs and "race conditions" since this global variable is **shared** between concurrent
requests on the server.

### No side-effects
To avoid future troubles youre load functions should not have any side-effects.
This means call youre api maybe cache the data in the SsrCache and then return it.

### store state in the SearchParams
A good way to store state is in the searchParams. This lets the user copy the url
and get the same state again. The client and the server agree on what data to load
and how to display it.

For this you can either use normal a tags or use the router [open](/types/routing/classes/Router.html#open),
[push](/types/routing/classes/Router.html#push) or [replace](/types/routing/classes/Router.html#replace) methods.

```svelte
<script>
	import { getRouter, getRoute } from 'crelte';

	const router = getRouter();
	const route = getRoute();

	let gridView = $derived($route.getSearchParam('view') === 'grid');
</script>

<button
	class:active={!gridView}
	onclick={() => router.push(r => r.setSearchParam('view', null))}
>
	List
</button>
<button
	class:active={gridView}
	onclick={() => router.push(r => r.setSearchParam('view', 'grid'))}
>
	Grid
</button>

{#if gridView}
	<GridView />
{:else}
	<ListView />
{/if}
```

### Use ssrCache

To share data between the server and the client you can use the [SsrCache](/types/ssr/classes/SsrCache.html).

```svelte
<script module>
	const RANDOM_KEY = 'randomNumber';

	/** @type {import('crelte').LoadData} */
	export const loadData = {
		randomNumber: cr => {
			const cache = cr.ssrCache.get(RANDOM_KEY);
			if (cache) {
				// clear it so the next time we get a new random number
				// this code get's only executed on the client
				cr.ssrCache.set(RANDOM_KEY, null);
				return cache;
			}

			return cr.ssrCache.set(RANDOM_KEY, Math.random());
		}
	};
</script>

<script>
	let { randomNumber } = $props();
</script>

<p>Random number: {randomNumber}</p>
```

**Note**: The SsrCache does not get cleared on the client. So if you wan't
a fresh value you need to clear it yourself.

### Cookies

Cookies are a good way to store authentication tokens or smaller information which should only
exist for the current session or the current device.

```svelte
<script module>
	/** @type {import('crelte').LoadData} */
	export const loadData = {
		persistentNumber: cr => {
			let number = cr.cookies.get('number');
			if (number) return parseFloat(number);

			number = Math.random();

			cr.cookies.set('number', number.toString(), {
				// maxAge: specify a maxAge if you want that the data
				// lives longer than the session
			});

			return number;
		}
	};
</script>

<script>
	let { persistentNumber } = $props();
</script>

<p>Persistent number: {persistentNumber}</p>
```

### Route state or context

If you don't want to store the data inside the SearchParams you can also use the state or context.

#### State

State is the a mechanism provided by the window History API this means the data stored there is only available
on the client. See [`BaseRoute.setState`](/types/routing/classes/BaseRoute.html#setstate)

#### Context

Context is a way to attach any data to the current request or route. It will persist on that route until the object
is destroyed. This means is it not shared between the server and the client and is no longer available after calling `router.back`.

It can be useful to pass data between multiple loadData functions or from an `onRequest` handler or when doing a
`router.open` or similar call. See [`BaseRoute.setContext`](/types/routing/classes/BaseRoute.html#setcontext)
