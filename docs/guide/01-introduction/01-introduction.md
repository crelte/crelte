# Introduction

Crelte is an opinionated framework for building fast, modern digital experiences with Craft CMS and Svelte. It combines Craft’s flexible content modeling with a structured, frontend-first development approach powered by Svelte.

Crelte provides a clear way to build content-driven applications where Craft defines structure and content, and Svelte handles rendering and interactivity — without having to wire everything together manually for each project.

:::tip Before you begin
If you’re new to Crelte, we recommend starting with the tutorial to get a hands-on overview of how Craft and Svelte work together.

If you’re unfamiliar with either Craft CMS or Svelte, it may help to skim their introductions first.
:::

## What is Svelte?

In short, Svelte is a way of writing user interface components — like a navigation bar, comment section, or contact form — that users see and interact with in their browsers. The Svelte compiler converts your components to JavaScript and CSS at build time, resulting in small, fast client-side code.

If you’d like to learn more, check out the [Svelte tutorial](https://v4.svelte.dev/docs/introduction).

## What is Craft?

Craft CMS is a content management system designed for building custom digital experiences. It provides a flexible and intuitive interface for modeling, creating, and organizing content without being restricted by predefined templates or structures, while giving developers fine-grained control over content architecture and localization.

If you’d like to learn more, check out the [Craft CMS documentation](https://craftcms.com/docs/5.x/).

## What does Crelte do?

Crelte defines how Craft and Svelte work together.

It establishes conventions for routing, data loading, localization, and global content based on Craft’s content model, and exposes that data to Svelte components in a predictable way. Instead of treating Craft as a generic headless API, Crelte embraces Craft’s concepts and uses them to drive the frontend.

Crelte supports server-side rendering with client-side hydration, allowing pages to load quickly, remain SEO-friendly, and progressively enhance with interactivity. Combined with Vite and Hot Module Replacement (HMR), this provides a fast feedback loop and an excellent development experience.

### Crelte provides

- content-driven routing with built-in localization support
- first-class Matrix field rendering
- flexible data loading and caching strategies
- global content handling across pages
