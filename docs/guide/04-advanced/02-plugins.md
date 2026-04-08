# Plugins

Plugins allow to extend and customize the functionality of Crelte. The
main way plugins hook into crelte are via different functions on the plugin and
events, provided by [crelte.events](/types/plugins/classes/Events.html).

## Adding a plugin

By convention each plugins should have a function called `createMyPlugin` which
an optional parameter allowing to configure the plugin.
This function then needs to return a [PluginCreator](/types/plugins/type-aliases/PluginCreator.html)
function, which in turn will return a [Plugin](/types/plugins/interfaces/Plugin.html) object.

The plugin can then be added to the `App.svelte`:
```svelte
<script module>
	import { createMyPlugin } from './myPlugin.ts';

	export const plugins = [createMyPlugin()];
</script>
```

## Example

```ts
import { PluginCreator, Plugin } from 'crelte/plugins';

export function createMyPlugin(): PluginCreator {
	return crelte => new MyPlugin(crelte);
}

export function getMyPlugin(crelte?: Crelte): MyPlugin {
	crelte = crelte ?? getCrelte();
	return crelte.getPlugin('myPlugin') as MyPlugin;
}

export class MyPlugin implements Plugin {
	constructor(_crelte: Crelte) {}
	
	get name(): string {
		return 'myPlugin';	
	}
	
	loadData(cr: CrelteRequest) {
		console.log('loadData');
	}
}
```

## Using a plugin

By convention each plugin has a `getMyPlugin` function which accepts an optional
`Crelte` instance and returns the plugin instance.

In a component or a template you then can use the plugin like this:
```svelte
<script module>
	import { getMyPlugin } from './myPlugin.ts';
	
	/** @type {import('crelte').LoadData} */
	export const loadData = {
		// in loadData you need to provide crelte because
		pluginName: cr => getMyPlugin(cr).name
	};
</script>

<script>
	// in the component initialization you can omit the crelte instance
	const myPlugin = getMyPlugin();
</script>
```

## Functions

### toRequest
If your plugin loads data it could make sense to make it stateful.
With toRequest you can return a new instance of your plugin for each request allowing
to store request specific data on the plugin instance.

### loadGlobalData
Gets called in the loadGlobalData phase.

### loadData
Gets called in the loadData phase.

### render
Gets called right before the dom gets updated. In this function you should
transition back from a stateful plugin (toRequest).
[Example](/cookbook/plugin-page-theme.html)

## Events

For exact details when each request is fired see [Data flow](./01-data-flow.html).

### beforeRequest
Prefer to only return a promise if async work is needed, otherwise return without waiting.
This allows a push request to be done without a microtask.
Allowing for a better DX.

```ts
type Fn = (cr: CrelteRequest) => Promise<void> | void;
```

### loadGlobalData

```ts
type Fn = (cr: CrelteRequest) => Promise<any>;
```

### loadEntry
This will execute all listeners in sequence and stop on the first one
which returns an entry.  
Will be executed in preload as well.

```ts
type Fn = (cr: CrelteRequest) => Promise<Entry | null> | Entry | null;
```

### beforeQueryEntry
This allows to modify the entry query variables before the entry query
is executed.  
Will be executed in preload as well.

```ts
type Fn = (cr: CrelteRequest, vars: EntryQueryVars) => Promise<void> | void;
```

### afterLoadEntry
Will be executed in preload as well.

```ts
type Fn = (cr: CrelteRequest) => Promise<any>;
```

### loadData

```ts
type Fn = (cr: CrelteRequest, entry: Entry) => Promise<any>;
```

### beforeRender

```ts
type Fn = (cr: CrelteRequest, route: Route) => void;
```

### afterRender
Gets executed after a render. This can be used to scroll to a specific
location or similar.

```ts
type Fn = (cr: CrelteRequest, route: Route) => void;
```

## Inside App.svelte

If you need to access some event but a fullblown plugin is overkill you can
export the init function from App.svelte.

```svelte
<script module>
	/** @type {import('crelte').Init} */
	export function init(crelte) {
		crelte.events.on('beforeRequest', () => console.log('beforeRequest'));
	}
</script>
```
