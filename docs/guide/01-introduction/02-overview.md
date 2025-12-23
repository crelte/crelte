# Architecture overview

This page provides a high-level view of how a Crelte project is structured and how requests flow through the system. It is intended to give you a mental model of how the different pieces fit together before diving into individual concepts.

## How everything fits together

A Crelte project consists of two separate applications:

- **Craft CMS** runs as the backend and is responsible for content modeling, localization, and data delivery.
- **Svelte** runs as the frontend and is responsible for rendering pages and handling interactivity.

This separation exists in both development and production. Craft acts as the source of truth for content and routing decisions, while Svelte renders the resulting pages using data provided by Craft.

## Request lifecycle

The following diagram illustrates the lifecycle of a typical page request:

![example](/overview-example.svg)

At a high level, a request goes through these stages:

1. **Routing and content resolution**  
   When a user visits a URL, Crelte determines which Craft site, language, and entry the request refers to. Craft resolves the entry and returns structured content data via GraphQL.

2. **Template resolution**  
   Based on the resolved entry, Crelte selects a corresponding Svelte template. This mapping is driven by Craft’s content structure, allowing templates to follow content rather than URL patterns.

3. **Rendering**  
   The selected template is rendered using the data provided by Craft and any additional data loaded by the template itself. Rendering can occur on the server for fast initial loads and SEO, with client-side hydration enabling interactivity.

This flow remains consistent regardless of whether rendering happens on the server or in the browser.

## Key concepts

Several core concepts build on this architecture and are documented in more detail elsewhere:

### GraphQL

GraphQL is the primary way Crelte retrieves content from Craft. It allows you to define exactly which data is needed for a page and ensures a predictable data shape for your templates.

[Learn more about GraphQL in Crelte](/guide/02-core/03-graphql.html)

### Globals

Globals represent content that is shared across multiple pages, such as navigation, footers, or branding elements. Crelte extends Craft’s global sets and makes them available alongside entry-specific data.

[Learn more about Globals](/guide/02-core/04-globals.html)
