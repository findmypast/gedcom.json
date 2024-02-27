import Store from '../models/Store.js';

export let parsingOptions;

/**
 * Store for file\text processing
 * @internal
 */
export let store = new Store();

/**
 * Resets all variables, which are used for parsing
 */
export function ResetProcessing() {
  store.Reset();
  parsingOptions = {};
}

export function SetParsingOptions(options) {
  parsingOptions = options;
}
