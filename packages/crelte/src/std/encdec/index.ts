import { escape_html } from './escaping.js';

/**
 * Convert newlines to <br> tags and escape HTML.
 *
 * #### Example
 * ```svelte
 * {@html nl2br("Hello\nWorld")}
 * ```
 */
export function nl2br(str: string): string {
	return escape_html(str).replace(/\n/g, '<br>');
}
