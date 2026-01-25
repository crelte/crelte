# Translations

Craft has great multilingual support which works with crelte out of the box. But
sometimes you don't want to have all text inside a globalSet or an entry field. For
those cases you can use the translations plugin.

It can either use a file loader which will store translations json files in the
public folder, or you can add json fields to a globalSet.

## File loader

To use the file loader, first add the translations Plugin:

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
`{lang}` is the site's language.

## GlobalSet loader

To use the globalSet loader, first add the translations Plugin:

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

Then in you're `global.graphql` export a `translations` globalSet with namespaces
as fields, at least `common`.

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

Where `getTranslations` will return a store with the translation function for the
`common` namespace by default.

## Different namespace

If you want to use a different namespace, you can pass it as the first argument
to `getTranslations`.
But note that you either have to load it with the argument `loadNamespaces` in the
`createTranslations` options or call
[loadTranslations](/types/translations/functions/loadTranslations.html#function-loadtranslations)
inside a `loadData`.
