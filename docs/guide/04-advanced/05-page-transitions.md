# Page transition

Page transitions are maybe easier than you might expect. They can give you website a cool effect
and can make it feel faster.

## Example

Create a component and add it globally to your `App.svelte`.

`PageTransition.svelte`
```svelte
<script>
	import { onRequest } from 'crelte';
	import { timeout } from 'crelte/std';
	import { tick } from 'svelte';

	onRequest(async cr => {
		// dont do a page transition if the navigation was not triggered by a click
		// or the data has not changed
		if (cr.req.origin !== 'click' || cr.req.disableLoadData) return;
		
		// signal the request that we want to delay the rendering of the page
		const delayRender = cr.req.delayRender();

		// todo add some animation logic here (for example a surface that covers the screen)
		await timeout(1000);

		// now we wait until all data has been successfully loaded
		// and the new page is has been rendered
		await delayRender.ready();
		// just for good measure we wait another tick
		await tick();

		// todo add some animation logic here (for example a surface that uncovers the screen)
		await timeout(END_DUR);
	});
</script>
```

This is possible because crelte allows you to delay the rendering of the new page while still loading
the data in the background. This way you can create smooth transitions between pages.

[onRequest](/types/crelte/functions/onRequest.html) calls you function once a new request is started.
