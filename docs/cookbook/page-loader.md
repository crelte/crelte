# PageLoader

Create a new component `PageLoader.svelte` and add it to your `App.svelte` which
will show a progress bar at the top of the page when navigating between pages.

```svelte
<script lang="ts">
	import { getLoadingProgress } from 'crelte';
	import { timeout } from 'crelte/std';

	const loadingProgress = getLoadingProgress();

	let hide = $state(true);
	let progress = $state(0);

	let version = 0;
	async function onProgress(prog: number) {
		// ignore the first call to this function
		if (version === 0) return (version = 1);

		// increasing the version invalidates previous calls
		const myVersion = ++version;
		// wait for ms and then return if it was cancelled
		const timeoutOrCancelled = (ms: number) =>
			timeout(ms).then(() => myVersion !== version);

		progress = prog;

		// should hide
		if (prog > 0.98) {
			// wait so we can see the progress bar filling
			if (await timeoutOrCancelled(200)) return;
			hide = true;
			// wait for the hide transition
			if (await timeoutOrCancelled(200)) return;
			progress = 0;

			return;
		}

		// show the loader if it was hidden
		if (hide) hide = false;
	}
	$effect(() => void onProgress($loadingProgress));
</script>

<div class="page-loader" class:hide style:--progress={progress}>
	<span></span>
</div>

<style>
	.page-loader {
		--loader-height: 3px;
		--loader-color: red;

		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: var(--loader-height);

		transform: translateY(0);
		z-index: var(--loader-z-index, 99);
		transition: transform 0.2s ease;
	}

	.page-loader.hide {
		transform: translateY(calc(var(--loader-height) * -1 - 1px));
	}

	.page-loader span {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		transform: scaleX(var(--progress, 0));
		transform-origin: left;
		background-color: var(--loader-color);
		transition: transform 0.5s ease;
	}
</style>
```
