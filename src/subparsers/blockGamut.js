import blockQuotes from './blockQuotes';
import headers from './headers';
import horizontalRule from './horizontalRule';
import lists from './lists';
import codeBlocks from './codeBlocks';
import tables from './tables';
import hashHTMLBlocks from './hashHTMLBlocks';
import paragraphs from './paragraphs';

/**
 * These are all the transformations that form block-level
 * tags like paragraphs, headers, and list items.
 */
export default function blockGamut (text, globals) {

  // we parse blockquotes first so that we can have headings and hrs
  // inside blockquotes
  text = blockQuotes(text, globals);
  text = headers(text, globals);

  // Do Horizontal Rules:
  text = horizontalRule(text, globals);

  text = lists(text, globals);
  text = codeBlocks(text, globals);
  text = tables(text, globals);

  // We already ran _HashHTMLBlocks() before, in Markdown(), but that
  // was to escape raw HTML in the original Markdown source. This time,
  // we're escaping the markup we've just created, so that we don't wrap
  // <p> tags around block-level tags.
  text = hashHTMLBlocks(text, globals);
  text = paragraphs(text, globals);

  return text;
}