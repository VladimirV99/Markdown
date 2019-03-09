import encodeCode from './encodeCode';
import { replaceRecursiveRegExp } from '../helpers';

/**
 * Hash and escape <pre><code> elements that should not be parsed as markdown
 */
export default function hashPreCodeTags(text, globals) {
  let repFunc = function (wholeMatch, match, left, right) {
    // encode html entities
    let codeblock = left + encodeCode(match, globals) + right;
    return '\n\n¨G' + (globals.ghCodeBlocks.push({text: wholeMatch, codeblock: codeblock}) - 1) + 'G\n\n';
  };

  // Hash <pre><code>
  text = replaceRecursiveRegExp(text, repFunc, '^ {0,'+globals.tabWidthLimit+'}<pre\\b[^>]*>\\s*<code\\b[^>]*>', '^ {0,'+globals.tabWidthLimit+'}</code>\\s*</pre>', 'gim');

  return text;
}