import { asteriskDashTildeAndColon, escapeCharactersCallback, isUndefined } from '../helpers';
import codeSpans from './codeSpans';
import emoji from './emoji';
// import underline from './underline';
import italicsAndBold from './italicsAndBold';
import strikethrough from './strikethrough';
import ellipsis from './ellipsis';
import hashHTMLSpans from './hashHTMLSpans';

// Transforms MD links into `<a>` html anchors
//
// A link contains link text (the visible text), a link destination (the URI that is the link destination), and
// optionally a link title. There are two basic kinds of links in Markdown.
// In inline links the destination and title are given immediately after the link text.
// In reference links the destination and title are defined elsewhere in the document.

/**
 * Helper function: Wrapper function to pass as second replace parameter
 *
 * @param {RegExp} rgx
 * @param {string} evtRootName
 * @param {{}} options
 * @param {{}} globals
 * @returns {Function}
 */
function replaceAnchorTag (rgx, globals, emptyCase) {
  emptyCase = !!emptyCase;
  return function (wholeMatch, text, id, url, m5, m6, title) {
    // bail we we find 2 newlines somewhere
    if (/\n\n/.test(wholeMatch)) {
      return wholeMatch;
    }
    return writeAnchorTag(wholeMatch, text, id, url, title, globals, emptyCase);
  };
}

/**
 * Helper Function: Normalize and write an anchor tag based on passed parameters
 * @param evt
 * @param options
 * @param globals
 * @param {boolean} emptyCase
 * @returns {string}
 */
function writeAnchorTag (wholeMatch, text, id, url, title, globals, emptyCase) {
  let target = '';

  if (!title) {
    title = '';
  }
  id = (id) ? id.toLowerCase() : '';

  if (emptyCase) {
    url = '';
  } else if (!url) {
    if (!id) {
      // lower-case and turn embedded newlines into spaces
      id = text.toLowerCase().replace(/ ?\n/g, ' ');
    }
    url = '#' + id;

    if (!isUndefined(globals.gUrls[id])) {
      url = globals.gUrls[id];
      if (!isUndefined(globals.gTitles[id])) {
        title = globals.gTitles[id];
      }
    } else {
      return wholeMatch;
    }
  }
  url = url.replace(asteriskDashTildeAndColon, escapeCharactersCallback);

  if (title !== '' && title !== null) {
    title = title.replace(/"/g, '&quot;');
    title = title.replace(asteriskDashTildeAndColon, escapeCharactersCallback);
    title = ' title="' + title + '"';
  }

  // optionLinksInNewWindow only applies
  // to external links. Hash links (#) open in same page
  if (!/^#/.test(url)) {
    // escaped _
    target = ' target="¨E95Eblank"';
  }

  // Text can be a markdown element, so we run through the appropriate parsers
  text = codeSpans(text, globals);
  text = emoji(text, globals);
  // text = underline(text, globals);
  text = italicsAndBold(text, globals);
  text = strikethrough(text, globals);
  text = ellipsis(text, globals);
  text = hashHTMLSpans(text, globals);

  let result = '<a href="' + url + '"' + title + target + '>' + text + '</a>';

  result = hashHTMLSpans(result, globals);
  return result;
}

/**
 * Turn Markdown link shortcuts into XHTML <a> tags.
 */
export default function links (text, globals) {

  // 1. Handle reference-style links: [link text] [id]
  text = links_reference(text, globals);

  // 2. Handle inline-style links: [link text](url "optional title")
  text = links_inline(text, globals);

  // 3. Handle reference-style shortcuts: [link text]
  // These must come last in case there's a [link text][1] or [link text](/foo)
  text = links_referenceShortcut(text, globals);

  // 4. Handle angle brackets links -> `<http://example.com/>`
  // Must come after links, because you can use < and > delimiters in inline links like [this](<url>).
  text = links_angleBrackets(text, globals);

  // 5. Handle GithubMentions (if option is enabled)
  // text = showdown.subParser('makehtml.links.ghMentions')(text, options, globals);

  // 6. Handle <a> tags and img tags
  text = text.replace(/<a\s[^>]*>[\s\S]*<\/a>/g, function (wholeMatch) {
    return _hashHTMLSpan(wholeMatch, globals);
  });

  text = text.replace(/<img\s[^>]*\/?>/g, function (wholeMatch) {
    return _hashHTMLSpan(wholeMatch, globals);
  });

  // 7. Handle naked links (if option is enabled)
  text = links_naked(text, globals);

  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_inline (text, globals) {
  
  // 1. Look for empty cases: []() and [empty]() and []("title")
  let rgxEmpty = /\[(.*?)]()()()()\(<? ?>? ?(?:["'](.*)["'])?\)/g;
  text = text.replace(rgxEmpty, replaceAnchorTag(rgxEmpty, globals, true));

  // 2. Look for cases with crazy urls like ./image/cat1).png
  let rgxCrazy = /\[((?:\[[^\]]*]|[^\[\]])*)]()\s?\([ \t]?<([^>]*)>(?:[ \t]*((["'])([^"]*?)\5))?[ \t]?\)/g;
  text = text.replace(rgxCrazy, replaceAnchorTag(rgxCrazy, globals));

  // 3. inline links with no title or titles wrapped in ' or ":
  // [text](url.com) || [text](<url.com>) || [text](url.com "title") || [text](<url.com> "title")
  //var rgx2 = /\[[ ]*[\s]?[ ]*([^\n\[\]]*?)[ ]*[\s]?[ ]*] ?()\(<?[ ]*[\s]?[ ]*([^\s'"]*)>?(?:[ ]*[\n]?[ ]*()(['"])(.*?)\5)?[ ]*[\s]?[ ]*\)/; // this regex is too slow!!!
  let rgx2 = /\[([\S ]*?)]\s?()\( *<?([^\s'"]*?(?:\([\S]*?\)[\S]*?)?)>?\s*(?:()(['"])(.*?)\5)? *\)/g;
  text = text.replace(rgx2, replaceAnchorTag(rgx2, globals));

  // 4. inline links with titles wrapped in (): [foo](bar.com (title))
  let rgx3 = /\[([\S ]*?)]\s?()\( *<?([^\s'"]*?(?:\([\S]*?\)[\S]*?)?)>?\s+()()\((.*?)\) *\)/g;
  text = text.replace(rgx3, replaceAnchorTag(rgx3, globals));
  
  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_reference (text, globals) {

  let rgx = /\[((?:\[[^\]]*]|[^\[\]])*)] ?(?:\n *)?\[(.*?)]()()()()/g;
  text = text.replace(rgx, replaceAnchorTag(rgx, globals));

  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_referenceShortcut (text, globals) {

  let rgx = /\[([^\[\]]+)]()()()()()/g;
  text = text.replace(rgx, replaceAnchorTag(rgx, globals));

  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_angleBrackets (text, globals) {

  // 1. Parse links first
  let urlRgx  = /<(((?:https?|ftp):\/\/|www\.)[^'">\s]+)>/gi;
  text = text.replace(urlRgx, function (wholeMatch, url, urlStart) {
    let text = url;
    url = (urlStart === 'www.') ? 'http://' + url : url;
    return writeAnchorTag(wholeMatch, text, null, url, null, globals);
  });

  return text;
}

/**
 * TODO MAKE THIS WORK (IT'S NOT ACTIVATED)
 * TODO WRITE THIS DOCUMENTATION
 */
function links_naked (text, globals) {

  // 2. Now we check for
  // we also include leading markdown magic chars [_*~] for cases like __https://www.google.com/foobar__
  let urlRgx = /([_*~]*?)(((?:https?|ftp):\/\/|www\.)[^\s<>"'`´.-][^\s<>"'`´]*?\.[a-z\d.]+[^\s<>"']*)\1/gi;
  text = text.replace(urlRgx, function (wholeMatch, leadingMDChars, url, urlPrefix) {

    // we now will start traversing the url from the front to back, looking for punctuation chars [_*~,;:.!?\)\]]
    let len = url.length;
    let suffix = '';
    for (let i = len - 1; i >= 0; --i) {
      let char = url.charAt(i);

      if (/[_*~,;:.!?]/.test(char)) {
        // it's a punctuation char
        // we remove it from the url
        url = url.slice(0, -1);
        // and prepend it to the suffix
        suffix = char + suffix;
      } else if (/\)/.test(char)) {
        let opPar = url.match(/\(/g) || [];
        let clPar = url.match(/\)/g);

        // it's a curved parenthesis so we need to check for "balance" (kinda)
        if (opPar.length < clPar.length) {
          // there are more closing Parenthesis than opening so chop it!!!!!
          url = url.slice(0, -1);
          // and prepend it to the suffix
          suffix = char + suffix;
        } else {
          // it's (kinda) balanced so our work is done
          break;
        }
      } else if (/]/.test(char)) {
        let opPar2 = url.match(/\[/g) || [];
        let clPar2 = url.match(/\]/g);
        // it's a squared parenthesis so we need to check for "balance" (kinda)
        if (opPar2.length < clPar2.length) {
          // there are more closing Parenthesis than opening so chop it!!!!!
          url = url.slice(0, -1);
          // and prepend it to the suffix
          suffix = char + suffix;
        } else {
          // it's (kinda) balanced so our work is done
          break;
        }
      } else {
        // it's not a punctuation or a parenthesis so our work is done
        break;
      }
    }

    // we copy the treated url to the text variable
    let text = url;
    // finally, if it's a www shortcut, we prepend http
    url = (urlPrefix === 'www.') ? 'http://' + url : url;

    // url part is done so let's take care of text now
    // we need to escape the text (because of links such as www.example.com/foo__bar__baz)
    text = text.replace(asteriskDashTildeAndColon, escapeCharactersCallback);

    // and return the link tag, with the leadingMDChars and  suffix. The leadingMDChars are added at the end too because
    // we consumed those characters in the regexp
    return leadingMDChars + writeAnchorTag(wholeMatch, text, null, url, null, globals) + suffix + leadingMDChars;
  });

  return text;
}