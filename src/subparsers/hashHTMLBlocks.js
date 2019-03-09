import { regexIndexOf, splitAtIndex, replaceRecursiveRegExp } from '../helpers';
import hashElement from './hashElement';

export default function hashHTMLBlocks (text, globals) {
  let blockTags = [
        'pre',
        'div',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'blockquote',
        'table',
        'dl',
        'ol',
        'ul',
        'script',
        'noscript',
        'form',
        'fieldset',
        'iframe',
        'math',
        'style',
        'section',
        'header',
        'footer',
        'nav',
        'article',
        'aside',
        'address',
        'audio',
        'canvas',
        'figure',
        'hgroup',
        'output',
        'video',
        'p'
  ],
  repFunc = function (wholeMatch, match, left, right) {
    let txt = wholeMatch;
    // check if this html element is marked as markdown
    // if so, it's contents should be parsed as markdown
    if (left.search(/\bmarkdown\b/) !== -1) {
      txt = left + makeHtml(match) + right;
    }
    return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
  };

  // encode backslash escaped HTML tags
  text = text.replace(/\\<(\/?[^>]+?)>/g, function (wm, inside) {
    return '&lt;' + inside + '&gt;';
  });

  // hash HTML Blocks
  for (let i = 0; i < blockTags.length; ++i) {

    let opTagPos,
        rgx1     = new RegExp('^ {0,' + globals.tabWidthLimit + '}(<' + blockTags[i] + '\\b[^>]*>)', 'im'),
        patLeft  = '<' + blockTags[i] + '\\b[^>]*>',
        patRight = '</' + blockTags[i] + '>';
    // 1. Look for the first position of the first opening HTML tag in the text
    while ((opTagPos = regexIndexOf(text, rgx1)) !== -1) {

      // if the HTML tag is \ escaped, we need to escape it and break


      //2. Split the text in that position
      let subTexts = splitAtIndex(text, opTagPos),
      //3. Match recursively
          newSubText1 = replaceRecursiveRegExp(subTexts[1], repFunc, patLeft, patRight, 'im');

      // prevent an infinite loop
      if (newSubText1 === subTexts[1]) {
        break;
      }
      text = subTexts[0].concat(newSubText1);
    }
  }
  // HR SPECIAL CASE
  text = text.replace(new RegExp('(\n {0,'+globals.tabWidthLimit+'}(<(hr)\\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))', 'g'),
    hashElement(text, globals));

  // Special case for standalone HTML comments
  text = replaceRecursiveRegExp(text, function (txt) {
    return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
  }, '^ {0,'+globals.tabWidthLimit+'}<!--', '-->', 'gm');

  return text;
}