import { replaceRecursiveRegExp } from '../helpers';
import encodeCode from './encodeCode';

/**
 * Hash and escape <code> elements that should not be parsed as markdown
 */
export default function hashCodeTags (text, globals) {
  let repFunc = function (wholeMatch, match, left, right) {
    let codeblock = left + encodeCode(match, globals) + right;
    return '¨C' + (globals.gHtmlSpans.push(codeblock) - 1) + 'C';
  };

  // Hash naked <code>
  text = replaceRecursiveRegExp(text, repFunc, '<code\\b[^>]*>', '</code>', 'gim');

  return text;
}