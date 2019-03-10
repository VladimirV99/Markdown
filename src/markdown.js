import detab from './subparsers/detab';
import hashPreCodeTags from './subparsers/hashPreCodeTags';
import githubCodeBlocks from './subparsers/githubCodeBlocks';
import hashHTMLBlocks from './subparsers/hashHTMLBlocks';
import hashCodeTags from './subparsers/hashCodeTags';
import stripLinkDefinitions from './subparsers/stripLinkDefinitions';
import blockGamut from './subparsers/blockGamut';
import unhashHTMLSpans from './subparsers/unhashHtmlSpans';
import unescapeSpecialChars from './subparsers/unescapeSpecialChars';

function makeHtml(text) {
  //check if text is not falsy
  if (!text) {
    return text;
  }

  const tab_width = 4;
  const tab_width_limit = tab_width-1;
  let tab = '';
  for(let i = 0; i < tab_width; i++) {
    tab += ' ';
  }

  let globals = {
    gHtmlBlocks:     [],
    gHtmlSpans:      [],
    gUrls:           {},
    gTitles:         {},
    gDimensions:     {},
    gListLevel:      0,
    ghCodeBlocks:    [],
    tab:             tab,
    tabWidth:        tab_width,
    tabWidthLimit:   tab_width_limit,
    idPrefix:        'mdh-'
  };

  // This lets us use ¨ trema as an escape char to avoid md5 hashes
  // The choice of character is arbitrary; anything that isn't
  // magic in Markdown will work.
  text = text.replace(/¨/g, '¨T');

  // Replace $ with ¨D
  // RegExp interprets $ as a special character
  // when it's in a replacement string
  text = text.replace(/\$/g, '¨D');

  // Standardize line endings
  text = text.replace(/\r\n/g, '\n'); // DOS to Unix
  text = text.replace(/\r/g, '\n'); // Mac to Unix

  // Stardardize line spaces
  text = text.replace(/\u00A0/g, '&nbsp;');

  // Make sure text begins and ends with a couple of newlines:
  text = '\n\n' + text + '\n\n';

  // detab
  text = detab(text, globals);

  /**
   * Strip any lines consisting only of spaces and tabs.
   * This makes subsequent regexs easier to write, because we can
   * match consecutive blank lines with /\n+/ instead of something
   * contorted like /[ \t]*\n+/
   */
  text = text.replace(/^[ \t]+$/mg, '');

  // run the sub parsers
  text = hashPreCodeTags(text, globals);
  text = githubCodeBlocks(text, globals);
  text = hashHTMLBlocks(text, globals);
  text = hashCodeTags(text, globals);
  text = stripLinkDefinitions(text, globals);
  text = blockGamut(text, globals);
  text = unhashHTMLSpans(text, globals);
  text = unescapeSpecialChars(text, globals);

  // attacklab: Restore dollar signs
  text = text.replace(/¨D/g, '$$');

  // attacklab: Restore tremas
  text = text.replace(/¨T/g, '¨');

  return text;
}

export {
  makeHtml
}