# Overview

The overview will give you a general look of how all things work together and where to look for them. This section helps you understand the system as a whole before diving into specific components and documentation.

## How everything fits together

Your Crelte project consists of two applications: Craft CMS in the backend and Svelte in the frontend. This separation exists in both development and production environments.

## Example request flow

Let's trace an example request to illustrate the core concepts:

![example](/overview-example.svg)

1. A user visits our website at:
   `crelte.com/en/articles/hello-world`.
   Crelte's router determines which templates to load and what data to fetch from the backend.
   The routing is dynamically controlled by Craft CMS. In this example, the router first identifies `crelte.blog/en` as the [site](https://craftcms.com/docs/5.x/system/sites.html) from the URL,
   and then looks for English entries, since this is localized by default in Craft CMS.
   During this step, Crelte also loads specified GraphQL data for the given entry. This data will be passed down to the template component in the next step.

2. Once the entry is retrieved from the backend, Crelte loads the appropriate template.
   In our example, it loads the `articles.svelte` file from the `/svelte/src/templates/` directory. This happens automatically because the router uses the handle of the entry.
   The template then executes its data loading logic. There are several approaches to loading data, which are detailed in the [Load data](#) documentation.

3. The template gets rendered. It receives the combined data from both the template's load data function and from the entries.graphql query.
   This rendering can happen on either the client or server, as Crelte fully supports [Server-Side Rendering (SSR)](https://developer.mozilla.org/en-US/docs/Glossary/SSR).

That's the fundamental data flow, but here are some additional important concepts:

### graphql

GraphQL is how we specify what data to request from the backend. It's Craft's preferred method for headless content delivery, allowing us to explicitly define the shape of the data we need.
Crelte provides helpers to work with GraphQL easily, both from the server and client, using dedicated GraphQL files or inline queries. [Learn more](/guide/02-core/03-graphql.html)

### Globals

Globals are a Craft concept that Crelte extends. They represent data that's important across multiple pages, independent of the specific content being viewed. Examples include header navigation, footer content, logos, or theme colors.
[Learn more](/guide/02-core/04-globals.html)
