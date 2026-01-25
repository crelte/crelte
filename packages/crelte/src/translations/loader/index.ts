import { Translations } from '../translationsPlugin.js';
import { Crelte, CrelteRequest } from '../../crelte.js';

export interface TranslationsLoader {
	load(cr: CrelteRequest, namespace: string): Promise<Translations>;
}

export type LoaderCreator = (crelte: Crelte) => TranslationsLoader;
