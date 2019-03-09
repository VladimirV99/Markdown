import codeSpans from './codeSpans';
import escapeSpecialCharsWithinTagAttributes from './escapeSpecialCharsWithinTagAttributes';
import encodeBackslashEscapes from './encodeBackslashEscapes';
import images from './images';
import links from './links';
import emoji from './emoji';
// import underline from './underline';
import italicsAndBold from './italicsAndBold';
import strikethrough from './strikethrough';
import ellipsis from './ellipsis';
import hashHTMLSpans from './hashHTMLSpans';
import encodeAmpsAndAngles from './encodeAmpsAndAngles';

/**
 * These are all the transformations that occur *within* block-level
 * tags like paragraphs, headers, and list items.
 */
export default function spanGamut (text, globals) {

  text = codeSpans(text, globals);
  text = escapeSpecialCharsWithinTagAttributes(text, globals);
  text = encodeBackslashEscapes(text, globals);

  // Process link and image tags. Images must come first,
  // because ![foo][f] looks like a link.
  text = images(text, globals);

  text = links(text, globals);

  text = emoji(text, globals);
  // text = underline(text, globals);
  text = italicsAndBold(text, globals);
  text = strikethrough(text, globals);
  text = ellipsis(text, globals);

  // we need to hash HTML tags inside spans
  text = hashHTMLSpans(text, globals);

  // now we encode amps and angles
  text = encodeAmpsAndAngles(text, globals);

  // Do hard breaks
  // GFM style hard breaks
  // only add line breaks if the text does not contain a block (special case for lists)
  if (!/\n\n¨K/.test(text)) {
    text = text.replace(/\n+/g, '<br />\n');
  }

  return text;
}