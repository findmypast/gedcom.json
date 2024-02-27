import yaml from 'js-yaml';
import { ResetProcessing, SetParsingOptions, parsingOptions } from '../../common/parsingOptions.js';
import { readFileSync } from 'fs';
import ParsedLine from '../../models/ParsedLine.js';
import ParsingOptions from '../../models/ParsingOptions.js';
import chunk from 'lodash/chunk.js';

let tagDictionary = {
  OTHER: 0
};

let json = {};
let lineNumber = 1;

/** @type { ParsedLine[] } */
const store = [];

const createTagDictionary = () => {
  tagDictionary = {
    OTHER: 0
  };

  const referenceTags = parsingOptions.Definition.filter((x) => x.Property === 'ImportId');
  for (const referenceTag of referenceTags) {
    tagDictionary[referenceTag.Tag] = 0;
  }
};

/**
 * @param { ParsingOptions } options
 * @returns { Promise<string | undefined> }
 */
export const parseJSONFile = async (options) => {
  try {
    const yamlOptions = yaml.safeLoad(options.GetConfig());
    SetParsingOptions(yamlOptions);
  } catch (e) {
    ResetProcessing();
    return;
  }

  createTagDictionary();

  json = JSON.parse(readFileSync(options.GetFilePath(), 'utf-8'));
  lineNumber = 1;
  store.length = 0;

  processJSON(json.Object, 0);

  store.push(new ParsedLine(++lineNumber, 0, 'TRLR'));

  return store.map((x) => x.toGedcomLine()).join('\n');
};

/**
 * @param { import('@gedcom-poc/core/src/@types/types.js').Gedcom | {} } json
 * @param { number } level
 */
const processJSON = (json, level) => {
  for (const key in json) {
    if (Object.hasOwnProperty.call(json, key)) {
      const element = json[key];
      if (Array.isArray(element)) {
        for (const e of element) {
          if (typeof e === 'object') {
            makeTag(level, key, element, json);
            processJSON(e, level + 1);
          } else {
            processJSON({ [key]: e }, level);
          }
        }
      } else if (typeof element === 'object') {
        makeTag(level, key, element, json);
        processJSON(element, level + 1);
      } else {
        makeTag(level, key, element, json);
      }
    }
  }
};

const addValueToPreviousLine = (key, element, level, parent) => {
  const previousLine = store.pop();
  const tagDetails = parsingOptions.Definition.filter((x) => x.Tag === previousLine.Tag)[0];
  if (!previousLine.Value && !previousLine.ReferenceId) {
    if (elementIsJustPlaceholderValue()) {
      // Don't bother adding just the placeholder hyphen value.
    } else if (elementIsAReference()) {
      previousLine.ReferenceId = lookupReference(previousLine.Tag, element);
    } else {
      if (elementIsDateValue()) {
        previousLine.Value = stripTimeFromDateString();
        store.push(previousLine);
        addTimeFromDate();
        return;
      } else {
        previousLine.Value = element;
      }
    }
  }
  store.push(previousLine);

  function addTimeFromDate() {
    const timeTag = element.match(/\d\d:\d\d:\d\d$/)[0];
    if (timeTag) {
      store.push(new ParsedLine(++lineNumber, level++, 'TIME', timeTag));
    }
  }

  function stripTimeFromDateString() {
    return element.replace(/ \d\d:\d\d:\d\d$/, '');
  }

  function elementIsDateValue() {
    return key === 'Original' && previousLine.Tag === 'DATE' && parent['HasTime'];
  }

  function elementIsAReference() {
    return (
      (key === 'ImportId' && element.match(/.{8}-.{4}-.{4}-.{12}/)) ||
      (key === 'ImportId' && previousLine.Tag === 'SUBM')
    );
  }

  function elementIsJustPlaceholderValue() {
    return (key === 'ImportId' || key === 'Value' || tagDetails.StartWith === '-') && element === '-';
  }
};

/**
 * @param { number } level
 * @param { string } key
 * @param { any } element
 * @param { any } parent
 * @returns
 */
export const makeTag = (level, key, element, parent) => {
  const tag = parsingOptions.Definition.filter((x) => x.Property === key || x.CollectAs === key)[0];

  if (valueShouldBeOnPreviousLine()) {
    addValueToPreviousLine(key, element, level, parent);
    return;
  }

  if (tag) {
    const parsedLine = new ParsedLine(lineNumber, level, tag.Tag);
    store.push(parsedLine);
    if (typeof element === 'string') {
      if (tag.ReferenceTag) {
        parsedLine.Value = lookupReference(tag.Tag, element);
      } else if (element.length > 240) {
        const chunks = chunk(element.toString(), 240);
        for (let index = 0; index < chunks.length; index++) {
          const part = chunks[index];
          if (index === 0) {
            parsedLine.Value = part.join('');
          } else {
            lineNumber++;
            const contLine = new ParsedLine(lineNumber, level + 1, 'CONC', part.join(''));
            store.push(contLine);
          }
        }
      } else {
        parsedLine.Value = element;
      }
    }
    lineNumber++;
  }

  function valueShouldBeOnPreviousLine() {
    return (
      key === 'ImportId' ||
      key === 'Original' ||
      key === 'Value' ||
      (tag && tag.Property && tag.Property === key && tag.CollectAs)
    );
  }
};

/**
 * @param { string } tag
 * @param { string } value
 */
const lookupReference = (tag, value) => {
  const ref = tagDictionary[value];
  if (ref) {
    return ref;
  }

  const tagDetails = parsingOptions.Definition.filter((x) => x.Tag === tag)[0];

  if (!tagDetails) {
    tagDictionary['OTHER']++;
    tagDictionary[value] = `@X${tagDictionary['OTHER']}@`;
    return tagDictionary[value];
  }

  const referenceTag = parsingOptions.Definition.filter((x) => x.Tag === tagDetails.ReferenceTag)[0];

  tagDictionary[referenceTag.Tag]++;
  tagDictionary[value] = `@${referenceTag.ReferencePrefix}${tagDictionary[referenceTag.Tag]}@`;

  return tagDictionary[value];
};
