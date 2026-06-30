# Translations

Craft CMS has great multilingual support which works with Crelte out of the box. But
sometimes you do not want to have all text inside a globalSet or an entry field. For
those cases you can use the translations plugin.

It can either use a file loader which will store json files containing translations in the
`/public` folder, or you can add json fields to a globalSet.

## File loader

To use the file loader, first add the translations plugin:

`App.svelte`

```svelte
<script module>
	import { createTranslations, createFileLoader } from 'crelte/translations';

	export const plugins = [
		createTranslations({
			loader: createFileLoader()
		})
	];
</script>
```

Translations will now try to read the files from `public/translations/{lang}/common.json`.
`{lang}` is the site's language, e.g. `en` or `de`.

**Example** `common.json`

```json
{
	"welcome_message": "Welcome to our page",
	"welcome_cta": "Discover now"
	// ...
}
```

## GlobalSet loader

To use the globalSet loader, first add the translations plugin:

`App.svelte`

```svelte
<script module>
	import { createTranslations, createGlobalLoader } from 'crelte/translations';

	export const plugins = [
		createTranslations({
			loader: createGlobalLoader()
		})
	];
</script>
```

Then in your `global.graphql` export a `translations` globalSet with namespaces
as fields with `common` being the minimum requirement.

```graphql
query ($siteId: [QueryArgument]) {
	translations: globalSet(handle: "translations", siteId: $siteId) {
		... on translations_GlobalSet {
			common
		}
	}
}
```

## Usage

To now use translations in your components, you can use the
[getTranslations](/types/translations/functions/getTranslations.html#function-gettranslations) function
to get a translation function for a specific namespace.

```svelte
<script>
	import { getTranslations } from 'crelte/translations';

	const t = getTranslations();
</script>

<h1>{$t('welcome_message')}</h1>
```

`getTranslations` returns a store with the translation function for the `common` namespace by default.


## Variables

Translations can contain variables using curly braces. Pass the values as the second argument to the translation function.

**Example** `common.json`

```json
{
	"quiz_progress": "Question {current} of {total}."
}
```

```svelte
<script>
	import { getTranslations } from 'crelte/translations';

	const t = getTranslations();

	let currentIndex = 0;
	let questions = ['A', 'B', 'C'];
</script>

<p>
	{$t('quiz_progress', {
		current: currentIndex + 1,
		total: questions.length
	})}
</p>
```

This will output:

```html
<p>Question 1 of 3.</p>
```

Variable values can be strings or numbers. `null` and `undefined` are treated as missing values and will leave the placeholder unresolved.

## Different namespace

If you want to use a different namespace, you can pass it as the first argument to `getTranslations`.

Note that you either have to load it with the argument `loadNamespaces` in the `createTranslations` options or call [loadTranslations](/types/translations/functions/loadTranslations.html#function-loadtranslations) inside a `loadData`.
