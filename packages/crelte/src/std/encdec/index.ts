import { escape_html } from './escaping.js';

/**
 * Convert newlines to <br> tags and escape HTML.
 *
 * #### Warning
 * When used in an attribute, the `isAttr` parameter needs to be set to `true`.
 *
 * #### Example
 * ```svelte
 * {@html nl2br("Hello\nWorld")}
 * ```
 */
export function nl2br(str: string, isAttr: boolean = false): string {
	return escape_html(str, isAttr).replace(/\n/g, '<br>');
}
