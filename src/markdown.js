const asteriskDashTildeAndColon = /([*_:~])/g;
const asteriskDashAndTilde = /([*_~])/g;

const tab_width = 4;
const tab_width_limit = tab_width-1;
let tab = '';
for(let i = 0; i < tab_width; i++) {
  tab += ' ';
}

function makeHtml(text) {
  //check if text is not falsy
  if (!text) {
    return text;
  }

  var globals = {
    gHtmlBlocks:     [],
    gHtmlSpans:      [],
    gUrls:           {},
    gTitles:         {},
    gDimensions:     {},
    gListLevel:      0,
    ghCodeBlocks:    []
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

/**
 * Convert all tabs to spaces
 */
function detab(text, globals) {
  // expand first n-1 tabs
  text = text.replace(/\t(?=\t)/g, tab); // g_tab_width

  // replace the nth with two sentinels
  text = text.replace(/\t/g, '¨A¨B');

  // use the sentinel to anchor our regex so it doesn't explode
  text = text.replace(/¨B(.+?)¨A/g, function (wholeMatch, m1) {
    var leadingText = m1,
        numSpaces = tab_width - leadingText.length % tab_width;  // g_tab_width

    // there *must* be a better way to do this:
    for (var i = 0; i < numSpaces; i++) {
      leadingText += ' ';
    }

    return leadingText;
  });

  // clean up sentinels
  text = text.replace(/¨A/g, tab);  // g_tab_width
  text = text.replace(/¨B/g, '');

  return text;
}

/**
 * Hash and escape <pre><code> elements that should not be parsed as markdown
 */
function hashPreCodeTags(text, globals) {
  var repFunc = function (wholeMatch, match, left, right) {
    // encode html entities
    var codeblock = left + encodeCode(match, globals) + right;
    return '\n\n¨G' + (globals.ghCodeBlocks.push({text: wholeMatch, codeblock: codeblock}) - 1) + 'G\n\n';
  };

  // Hash <pre><code>
  text = replaceRecursiveRegExp(text, repFunc, '^ {0,'+tab_width_limit+'}<pre\\b[^>]*>\\s*<code\\b[^>]*>', '^ {0,'+tab_width_limit+'}</code>\\s*</pre>', 'gim');

  return text;
}

function replaceRecursiveRegExp (str, replacement, left, right, flags) {
  if (!isFunction(replacement)) {
    var repStr = replacement;
    replacement = function () {
      return repStr;
    };
  }

  var matchPos = rgxFindMatchPos(str, left, right, flags),
      finalStr = str,
      lng = matchPos.length;

  if (lng > 0) {
    var bits = [];
    if (matchPos[0].wholeMatch.start !== 0) {
      bits.push(str.slice(0, matchPos[0].wholeMatch.start));
    }
    for (var i = 0; i < lng; ++i) {
      bits.push(
        replacement(
          str.slice(matchPos[i].wholeMatch.start, matchPos[i].wholeMatch.end),
          str.slice(matchPos[i].match.start, matchPos[i].match.end),
          str.slice(matchPos[i].left.start, matchPos[i].left.end),
          str.slice(matchPos[i].right.start, matchPos[i].right.end)
        )
      );
      if (i < lng - 1) {
        bits.push(str.slice(matchPos[i].wholeMatch.end, matchPos[i + 1].wholeMatch.start));
      }
    }
    if (matchPos[lng - 1].wholeMatch.end < str.length) {
      bits.push(str.slice(matchPos[lng - 1].wholeMatch.end));
    }
    finalStr = bits.join('');
  }
  return finalStr;
}

function escapeCharacters (text, charsToEscape, afterBackslash) {
  // First we have to escape the escape characters so that
  // we can build a character class out of them
  var regexString = '([' + charsToEscape.replace(/([\[\]\\])/g, '\\$1') + '])';

  if (afterBackslash) {
    regexString = '\\\\' + regexString;
  }

  var regex = new RegExp(regexString, 'g');
  text = text.replace(regex, escapeCharactersCallback);

  return text;
}

function rgxFindMatchPos(str, left, right, flags) {
  var f = flags || '',
      g = f.indexOf('g') > -1,
      x = new RegExp(left + '|' + right, 'g' + f.replace(/g/g, '')),
      l = new RegExp(left, f.replace(/g/g, '')),
      pos = [],
      t, s, m, start, end;

  do {
    t = 0;
    while ((m = x.exec(str))) {
      if (l.test(m[0])) {
        if (!(t++)) {
          s = x.lastIndex;
          start = s - m[0].length;
        }
      } else if (t) {
        if (!--t) {
          end = m.index + m[0].length;
          var obj = {
            left: {start: start, end: s},
            match: {start: s, end: m.index},
            right: {start: m.index, end: end},
            wholeMatch: {start: start, end: end}
          };
          pos.push(obj);
          if (!g) {
            return pos;
          }
        }
      }
    }
  } while (t && (x.lastIndex = s));

  return pos;
}

function escapeCharactersCallback (wholeMatch, m1) {
  var charCodeToEscape = m1.charCodeAt(0);
  return '¨E' + charCodeToEscape + 'E';
}

function isFunction (a) {
  var getType = {};
  return a && getType.toString.call(a) === '[object Function]';
}

function isString (a) {
  return (typeof a === 'string' || a instanceof String);
}

function isUndefined (value) {
  return typeof value === 'undefined';
}

/**
 * Returns the index within the passed String object of the first occurrence of the specified regex,
 * starting the search at fromIndex. Returns -1 if the value is not found.
 *
 * @param {string} str string to search
 * @param {RegExp} regex Regular expression to search
 * @param {int} [fromIndex = 0] Index to start the search
 * @returns {Number}
 * @throws InvalidArgumentError
 */
function regexIndexOf (str, regex, fromIndex) {
  if (!isString(str)) {
    throw 'InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string';
  }
  if (regex instanceof RegExp === false) {
    throw 'InvalidArgumentError: second parameter of showdown.helper.regexIndexOf function must be an instance of RegExp';
  }
  var indexOf = str.substring(fromIndex || 0).search(regex);
  return (indexOf >= 0) ? (indexOf + (fromIndex || 0)) : indexOf;
};

/**
 * Splits the passed string object at the defined index, and returns an array composed of the two substrings
 * @param {string} str string to split
 * @param {int} index index to split string at
 * @returns {[string,string]}
 * @throws InvalidArgumentError
 */
function splitAtIndex (str, index) {
  if (!isString(str)) {
    throw 'InvalidArgumentError: first parameter of showdown.helper.regexIndexOf function must be a string';
  }
  return [str.substring(0, index), str.substring(index)];
};

function _hashHTMLSpan (html, globals) {
  return '¨C' + (globals.gHtmlSpans.push(html) - 1) + 'C';
};

/**
 * Handle github codeblocks prior to running HashHTML so that
 * HTML contained within the codeblock gets escaped properly
 * Example:
 * ```ruby
 *     def hello_world(x)
 *       puts "Hello, #{x}"
 *     end
 * ```
 */
function githubCodeBlocks (text, globals) {

  text += '¨0';

  text = text.replace(new RegExp('(?:^|\n)(?: {0,'+tab_width_limit+'})(```+|~~~+)(?: *)([^\\s`~]*)\n([\\s\\S]*?)\n(?: {0,'+tab_width_limit+'})\\1', 'g'), function (wholeMatch, delim, language, codeblock) {
    // First parse the github code block
    codeblock = encodeCode(codeblock, globals);
    codeblock = detab(codeblock, globals);
    codeblock = codeblock.replace(/^\n+/g, ''); // trim leading newlines
    codeblock = codeblock.replace(/\n+$/g, ''); // trim trailing whitespace

    codeblock = '<pre><code' + (language ? ' class="' + language + ' language-' + language + '"' : '') + '>' + codeblock + '</code></pre>';

    codeblock = hashBlock(codeblock, globals);

    // Since GHCodeblocks can be false positives, we need to
    // store the primitive text and the parsed text in a global var,
    // and then return a token
    return '\n\n¨G' + (globals.ghCodeBlocks.push({text: wholeMatch, codeblock: codeblock}) - 1) + 'G\n\n';
  });

  // attacklab: strip sentinel
  text = text.replace(/¨0/, '');

  return text;
}

/**
 * Encode/escape certain characters inside Markdown code runs.
 * The point is that in code, these characters are literals,
 * and lose their special Markdown meanings.
 */
function encodeCode (text, globals) {
  // Encode all ampersands; HTML entities are not
  // entities within a Markdown code span.
  text = text
    .replace(/&/g, '&amp;')
  // Do the angle bracket song and dance:
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Now, escape characters that are magic in Markdown:
    .replace(/([*_{}\[\]\\=~-])/g, escapeCharactersCallback);

  return text;
}

function hashBlock (text, globals) {
  text = text.replace(/(^\n+|\n+$)/g, '');
  text = '\n\n¨K' + (globals.gHtmlBlocks.push(text) - 1) + 'K\n\n';
  return text;
}

function hashHTMLBlocks (text, globals) {
  var blockTags = [
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
    var txt = wholeMatch;
    // check if this html element is marked as markdown
    // if so, it's contents should be parsed as markdown
    if (left.search(/\bmarkdown\b/) !== -1) {
      txt = left + makeHtml(match) + right;
    }
    return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
  };

  text = text.replace(/\\<(\/?[^>]+?)>/g, function (wm, inside) {
    return '&lt;' + inside + '&gt;';
  });

  // hash HTML Blocks
  for (var i = 0; i < blockTags.length; ++i) {

    var opTagPos,
        rgx1     = new RegExp('^ {0,'+tab_width_limit+'}(<' + blockTags[i] + '\\b[^>]*>)', 'im'),
        patLeft  = '<' + blockTags[i] + '\\b[^>]*>',
        patRight = '</' + blockTags[i] + '>';
    // 1. Look for the first position of the first opening HTML tag in the text
    while ((opTagPos = regexIndexOf(text, rgx1)) !== -1) {

      // if the HTML tag is \ escaped, we need to escape it and break


      //2. Split the text in that position
      var subTexts = splitAtIndex(text, opTagPos),
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
  text = text.replace(new RegExp('(\n {0,'+tab_width_limit+'}(<(hr)\\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))', 'g'),
    hashElement(text, globals));

  // Special case for standalone HTML comments
  text = replaceRecursiveRegExp(text, function (txt) {
    return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
  }, '^ {0,'+tab_width_limit+'}<!--', '-->', 'gm');

  return text;
}

function hashElement (text, globals) {
  return function (wholeMatch, m1) {
    var blockText = m1;

    // Undo double lines
    blockText = blockText.replace(/\n\n/g, '\n');
    blockText = blockText.replace(/^\n/, '');

    // strip trailing blank lines
    blockText = blockText.replace(/\n+$/g, '');

    // Replace the element text with a marker ("¨KxK" where x is its key)
    blockText = '\n\n¨K' + (globals.gHtmlBlocks.push(blockText) - 1) + 'K\n\n';

    return blockText;
  };
}

/**
 * Hash and escape <code> elements that should not be parsed as markdown
 */
function hashCodeTags (text, globals) {
  var repFunc = function (wholeMatch, match, left, right) {
    var codeblock = left + encodeCode(match, globals) + right;
    return '¨C' + (globals.gHtmlSpans.push(codeblock) - 1) + 'C';
  };

  // Hash naked <code>
  text = replaceRecursiveRegExp(text, repFunc, '<code\\b[^>]*>', '</code>', 'gim');

  return text;
}

/**
 * Strips link definitions from text, stores the URLs and titles in
 * hash references.
 * Link defs are in the form: ^[id]: url "optional title"
 */
function stripLinkDefinitions (text, globals) {

  var regex       = new RegExp('^ {0,'+tab_width_limit+'}\\[(.+)]:[ \t]*\n?[ \t]*<?([^>\\s]+)>?(?: =([*\\d]+[A-Za-z%]{0,4})x([*\\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|\'(](.+?)["|\')][ \t]*)?(?:\n+|(?=¨0))', 'gm'),
      base64Regex = new RegExp('^ {0,'+tab_width_limit+'}\\[(.+)]:[ \t]*\n?[ \t]*<?(data:.+?\/.+?;base64,[A-Za-z0-9+/=\n]+?)>?(?: =([*\\d]+[A-Za-z%]{0,4})x([*\\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|\'(](.+?)["|\')][ \t]*)?(?:\n\n|(?=¨0)|(?=\n\\[))', 'gm');

  // attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
  text += '¨0';

  var replaceFunc = function (wholeMatch, linkId, url, width, height, blankLines, title) {
    linkId = linkId.toLowerCase();
    if (url.match(/^data:.+?\/.+?;base64,/)) {
      // remove newlines
      globals.gUrls[linkId] = url.replace(/\s/g, '');
    } else {
      globals.gUrls[linkId] = encodeAmpsAndAngles(url, globals);  // Link IDs are case-insensitive
    }

    if (blankLines) {
      // Oops, found blank lines, so it's not a title.
      // Put back the parenthetical statement we stole.
      return blankLines + title;

    } else {
      if (title) {
        globals.gTitles[linkId] = title.replace(/"|'/g, '&quot;');
      }
      if (width && height) {
        globals.gDimensions[linkId] = {
          width:  width,
          height: height
        };
      }
    }
    // Completely remove the definition from the text
    return '';
  };

  // first we try to find base64 link references
  text = text.replace(base64Regex, replaceFunc);

  text = text.replace(regex, replaceFunc);

  // attacklab: strip sentinel
  text = text.replace(/¨0/, '');

  return text;
}

/**
 * Smart processing for ampersands and angle brackets that need to be encoded.
 */
function encodeAmpsAndAngles (text, globals) {
  // Ampersand-encoding based entirely on Nat Irons's Amputator MT plugin:
  // http://bumppo.net/projects/amputator/
  text = text.replace(/&(?!#?[xX]?(?:[0-9a-fA-F]+|\w+);)/g, '&amp;');

  // Encode naked <'s
  text = text.replace(/<(?![a-z\/?$!])/gi, '&lt;');

  // Encode <
  text = text.replace(/</g, '&lt;');

  // Encode >
  text = text.replace(/>/g, '&gt;');

  return text;
}

/**
 * These are all the transformations that form block-level
 * tags like paragraphs, headers, and list items.
 */
function blockGamut (text, globals) {

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

function blockQuotes (text, globals) {

  // add a couple extra lines after the text and endtext mark
  text = text + '\n\n';

  var rgx = new RegExp('^ {0,'+tab_width_limit+'}>[\\s\\S]*?(?:\n\n)', 'gm');

  text = text.replace(rgx, function (bq) {
    // attacklab: hack around Konqueror 3.5.4 bug:
    // "----------bug".replace(/^-/g,"") == "bug"
    bq = bq.replace(/^[ \t]*>[ \t]?/gm, ''); // trim one level of quoting

    // attacklab: clean up hack
    bq = bq.replace(/¨0/g, '');

    bq = bq.replace(/^[ \t]+$/gm, ''); // trim whitespace-only lines
    bq = githubCodeBlocks(bq, globals);
    bq = blockGamut(bq, globals); // recurse

    bq = bq.replace(/(^|\n)/g, '$1  ');
    // These leading spaces screw with <pre> content, so we need to fix that:
    bq = bq.replace(/(\s*<pre>[^\r]+?<\/pre>)/gm, function (wholeMatch, m1) {
      var pre = m1;
      // attacklab: hack around Konqueror 3.5.4 bug:
      pre = pre.replace(/^  /mg, '¨0');
      pre = pre.replace(/¨0/g, '');
      return pre;
    });

    return hashBlock('<blockquote>\n' + bq + '\n</blockquote>', globals);
  });

  return text;
}

function headers (text, globals) {

  let headerLevelStart = 1;

  // Set text-style headers:
  //	Header 1
  //	========
  //
  //	Header 2
  //	--------
  //
  let setextRegexH1 = /^(.+)[ \t]*\n={2,}[ \t]*\n+/gm;
  let setextRegexH2 = /^(.+)[ \t]*\n-{2,}[ \t]*\n+/gm;

  text = text.replace(setextRegexH1, function (wholeMatch, m1) {
    let span = spanGamut(m1, globals),
        hLevel = headerLevelStart,
        hashBlockStr = '<h' + hLevel + '>' + span + '</h' + hLevel + '>';
    return hashBlock(hashBlockStr, globals);
  });

  text = text.replace(setextRegexH2, function (wholeMatch, m1) {
    let span = spanGamut(m1, globals),
        hLevel = headerLevelStart + 1,
        hashBlockStr = '<h' + hLevel + '>' + span + '</h' + hLevel + '>';
    return hashBlock(hashBlockStr, globals);
  });

  // atx-style headers:
  //  # Header 1
  //  ## Header 2
  //  ## Header 2 with closing hashes ##
  //  ...
  //  ###### Header 6
  //
  //TODO replace hardcoded 3
  let atxStyle = /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#* *\n+/gm;

  text = text.replace(atxStyle, function (wholeMatch, m1, m2) {
    let hText = m2;
    let span = spanGamut(hText, globals),
        hLevel = headerLevelStart - 1 + m1.length,
        header = '<h' + hLevel + '>' + span + '</h' + hLevel + '>';

    return hashBlock(header, globals);
  });

  return text;
}


/**
 * These are all the transformations that occur *within* block-level
 * tags like paragraphs, headers, and list items.
 */
function spanGamut (text, globals) {

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

/**
 *
 *   *  Backtick quotes are used for <code></code> spans.
 *
 *   *  You can use multiple backticks as the delimiters if you want to
 *     include literal backticks in the code span. So, this input:
 *
 *         Just type ``foo `bar` baz`` at the prompt.
 *
 *       Will translate to:
 *
 *         <p>Just type <code>foo `bar` baz</code> at the prompt.</p>
 *
 *    There's no arbitrary limit to the number of backticks you
 *    can use as delimters. If you need three consecutive backticks
 *    in your code, use four for delimiters, etc.
 *
 *  *  You can use spaces to get literal backticks at the edges:
 *
 *         ... type `` `bar` `` ...
 *
 *       Turns to:
 *
 *         ... type <code>`bar`</code> ...
 */
function codeSpans (text, globals) {

  if (isUndefined(text)) {
    text = '';
  }
  text = text.replace(/(^|[^\\])(`+)([^\r]*?[^`])\2(?!`)/gm,
    function (wholeMatch, m1, m2, m3) {
      var c = m3;
      c = c.replace(/^([ \t]*)/g, '');	// leading whitespace
      c = c.replace(/[ \t]*$/g, '');	// trailing whitespace
      c = encodeCode(c, globals);
      c = m1 + '<code>' + c + '</code>';
      c = hashHTMLSpans(c, globals);
      return c;
    }
  );

  return text;
}

/**
 * Within tags -- meaning between < and > -- encode [\ ` * _ ~ =] so they
 * don't conflict with their use in Markdown for code, italics and strong.
 */
function escapeSpecialCharsWithinTagAttributes (text, globals) {
  // Build a regex to find HTML tags.
  var tags     = /<\/?[a-z\d_:-]+(?:[\s]+[\s\S]+?)?>/gi,
      comments = /<!(--(?:(?:[^>-]|-[^>])(?:[^-]|-[^-])*)--)>/gi;

  text = text.replace(tags, function (wholeMatch) {
    return wholeMatch
      .replace(/(.)<\/?code>(?=.)/g, '$1`')
      .replace(/([\\`*_~=|])/g, escapeCharactersCallback);
  });

  text = text.replace(comments, function (wholeMatch) {
    return wholeMatch
      .replace(/([\\`*_~=|])/g, escapeCharactersCallback);
  });

  return text;
}

/**
 * Returns the string, with after processing the following backslash escape sequences.
 *
 * attacklab: The polite way to do this is with the new escapeCharacters() function:
 *
 *    text = escapeCharacters(text,"\\",true);
 *    text = escapeCharacters(text,"`*_{}[]()>#+-.!",true);
 *
 * ...but we're sidestepping its use of the (slow) RegExp constructor
 * as an optimization for Firefox.  This function gets called a LOT.
 */
function encodeBackslashEscapes (text, globals) {
  text = text.replace(/\\(\\)/g, escapeCharactersCallback);
  text = text.replace(/\\([`*_{}\[\]()>#+.!~=|:-])/g, escapeCharactersCallback);

  return text;
}

/**
 * Turn Markdown image shortcuts into <img> tags.
 */
function images (text, globals) {

  var inlineRegExp      = /!\[([^\]]*?)][ \t]*()\([ \t]?<?([\S]+?(?:\([\S]*?\)[\S]*?)?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(["'])([^"]*?)\6)?[ \t]?\)/g,
      crazyRegExp       = /!\[([^\]]*?)][ \t]*()\([ \t]?<([^>]*)>(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(?:(["'])([^"]*?)\6))?[ \t]?\)/g,
      base64RegExp      = /!\[([^\]]*?)][ \t]*()\([ \t]?<?(data:.+?\/.+?;base64,[A-Za-z0-9+/=\n]+?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(["'])([^"]*?)\6)?[ \t]?\)/g,
      referenceRegExp   = /!\[([^\]]*?)] ?(?:\n *)?\[([\s\S]*?)]()()()()()/g,
      refShortcutRegExp = /!\[([^\[\]]+)]()()()()()/g;

  function writeImageTagBase64 (wholeMatch, altText, linkId, url, width, height, m5, title) {
    url = url.replace(/\s/g, '');
    return writeImageTag (wholeMatch, altText, linkId, url, width, height, m5, title);
  }

  function writeImageTag (wholeMatch, altText, linkId, url, width, height, m5, title) {

    var gUrls   = globals.gUrls,
        gTitles = globals.gTitles,
        gDims   = globals.gDimensions;

    linkId = linkId.toLowerCase();

    if (!title) {
      title = '';
    }
    // Special case for explicit empty url
    if (wholeMatch.search(/\(<?\s*>? ?(['"].*['"])?\)$/m) > -1) {
      url = '';

    } else if (url === '' || url === null) {
      if (linkId === '' || linkId === null) {
        // lower-case and turn embedded newlines into spaces
        linkId = altText.toLowerCase().replace(/ ?\n/g, ' ');
      }
      url = '#' + linkId;

      if (isUndefined(gUrls[linkId])) {
        url = gUrls[linkId];
        if (isUndefined(gTitles[linkId])) {
          title = gTitles[linkId];
        }
        if (isUndefined(gDims[linkId])) {
          width = gDims[linkId].width;
          height = gDims[linkId].height;
        }
      } else {
        return wholeMatch;
      }
    }

    altText = altText
      .replace(/"/g, '&quot;')
    //altText = showdown.helper.escapeCharacters(altText, '*_', false);
      .replace(asteriskDashTildeAndColon, escapeCharactersCallback);
    //url = showdown.helper.escapeCharacters(url, '*_', false);
    url = url.replace(asteriskDashTildeAndColon, escapeCharactersCallback);
    var result = '<img src="' + url + '" alt="' + altText + '"';

    if (title && isString(title)) {
      title = title
        .replace(/"/g, '&quot;')
      //title = showdown.helper.escapeCharacters(title, '*_', false);
        .replace(asteriskDashTildeAndColon, escapeCharactersCallback);
      result += ' title="' + title + '"';
    }

    if (width && height) {
      width  = (width === '*') ? 'auto' : width;
      height = (height === '*') ? 'auto' : height;

      result += ' width="' + width + '"';
      result += ' height="' + height + '"';
    }

    result += ' />';

    return result;
  }

  // First, handle reference-style labeled images: ![alt text][id]
  text = text.replace(referenceRegExp, writeImageTag);

  // Next, handle inline images:  ![alt text](url =<width>x<height> "optional title")

  // base64 encoded images
  text = text.replace(base64RegExp, writeImageTagBase64);

  // cases with crazy urls like ./image/cat1).png
  text = text.replace(crazyRegExp, writeImageTag);

  // normal cases
  text = text.replace(inlineRegExp, writeImageTag);

  // handle reference-style shortcuts: ![img text]
  text = text.replace(refShortcutRegExp, writeImageTag);

  return text;
}

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
  var target = '';

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

  var result = '<a href="' + url + '"' + title + target + '>' + text + '</a>';

  result = hashHTMLSpans(result, globals);
  return result;
}

/**
 * Turn Markdown link shortcuts into XHTML <a> tags.
 */
function links (text, globals) {

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
  var rgxEmpty = /\[(.*?)]()()()()\(<? ?>? ?(?:["'](.*)["'])?\)/g;
  text = text.replace(rgxEmpty, replaceAnchorTag(rgxEmpty, globals, true));

  // 2. Look for cases with crazy urls like ./image/cat1).png
  var rgxCrazy = /\[((?:\[[^\]]*]|[^\[\]])*)]()\s?\([ \t]?<([^>]*)>(?:[ \t]*((["'])([^"]*?)\5))?[ \t]?\)/g;
  text = text.replace(rgxCrazy, replaceAnchorTag(rgxCrazy, globals));

  // 3. inline links with no title or titles wrapped in ' or ":
  // [text](url.com) || [text](<url.com>) || [text](url.com "title") || [text](<url.com> "title")
  //var rgx2 = /\[[ ]*[\s]?[ ]*([^\n\[\]]*?)[ ]*[\s]?[ ]*] ?()\(<?[ ]*[\s]?[ ]*([^\s'"]*)>?(?:[ ]*[\n]?[ ]*()(['"])(.*?)\5)?[ ]*[\s]?[ ]*\)/; // this regex is too slow!!!
  var rgx2 = /\[([\S ]*?)]\s?()\( *<?([^\s'"]*?(?:\([\S]*?\)[\S]*?)?)>?\s*(?:()(['"])(.*?)\5)? *\)/g;
  text = text.replace(rgx2, replaceAnchorTag(rgx2, globals));

  // 4. inline links with titles wrapped in (): [foo](bar.com (title))
  var rgx3 = /\[([\S ]*?)]\s?()\( *<?([^\s'"]*?(?:\([\S]*?\)[\S]*?)?)>?\s+()()\((.*?)\) *\)/g;
  text = text.replace(rgx3, replaceAnchorTag(rgx3, globals));
  
  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_reference (text, globals) {

  var rgx = /\[((?:\[[^\]]*]|[^\[\]])*)] ?(?:\n *)?\[(.*?)]()()()()/g;
  text = text.replace(rgx, replaceAnchorTag(rgx, globals));

  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_referenceShortcut (text, globals) {

  var rgx = /\[([^\[\]]+)]()()()()()/g;
  text = text.replace(rgx, replaceAnchorTag(rgx, globals));

  return text;
}

/**
 * TODO WRITE THIS DOCUMENTATION
 */
function links_angleBrackets (text, globals) {

  // 1. Parse links first
  var urlRgx  = /<(((?:https?|ftp):\/\/|www\.)[^'">\s]+)>/gi;
  text = text.replace(urlRgx, function (wholeMatch, url, urlStart) {
    var text = url;
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
  var urlRgx = /([_*~]*?)(((?:https?|ftp):\/\/|www\.)[^\s<>"'`´.-][^\s<>"'`´]*?\.[a-z\d.]+[^\s<>"']*)\1/gi;
  text = text.replace(urlRgx, function (wholeMatch, leadingMDChars, url, urlPrefix) {

    // we now will start traversing the url from the front to back, looking for punctuation chars [_*~,;:.!?\)\]]
    var len = url.length;
    var suffix = '';
    for (var i = len - 1; i >= 0; --i) {
      var char = url.charAt(i);

      if (/[_*~,;:.!?]/.test(char)) {
        // it's a punctuation char
        // we remove it from the url
        url = url.slice(0, -1);
        // and prepend it to the suffix
        suffix = char + suffix;
      } else if (/\)/.test(char)) {
        var opPar = url.match(/\(/g) || [];
        var clPar = url.match(/\)/g);

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
        var opPar2 = url.match(/\[/g) || [];
        var clPar2 = url.match(/\]/g);
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
    var text = url;
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

/**
 * Hash span elements that should not be parsed as markdown
 */
function hashHTMLSpans (text, globals) {
  // Hash Self Closing tags
  text = text.replace(/<[^>]+?\/>/gi, function (wm) {
    return _hashHTMLSpan(wm, globals);
  });

  // Hash tags without properties
  text = text.replace(/<([^>]+?)>[\s\S]*?<\/\1>/g, function (wm) {
    return _hashHTMLSpan(wm, globals);
  });

  // Hash tags with properties
  text = text.replace(/<([^>]+?)\s[^>]+?>[\s\S]*?<\/\1>/g, function (wm) {
    return _hashHTMLSpan(wm, globals);
  });

  // Hash self closing tags without />
  text = text.replace(/<[^>]+?>/gi, function (wm) {
    return _hashHTMLSpan(wm, globals);
  });

  return text;
}

/**
 * Unhash HTML spans
 */
function unhashHTMLSpans (text, globals) {

  for (var i = 0; i < globals.gHtmlSpans.length; ++i) {
    var repText = globals.gHtmlSpans[i],
        // limiter to prevent infinite loop (assume 10 as limit for recurse)
        limit = 0;

    while (/¨C(\d+)C/.test(repText)) {
      var num = RegExp.$1;
      repText = repText.replace('¨C' + num + 'C', globals.gHtmlSpans[num]);
      if (limit === 10) {
        console.error('maximum nesting of 10 spans reached!!!');
        break;
      }
      ++limit;
    }
    text = text.replace('¨C' + i + 'C', repText);
  }

  return text;
}

/**
 * These are all the transformations that occur *within* block-level
 * tags like paragraphs, headers, and list items.
 */
function emoji (text, globals) {

  var emojiRgx = /:([\S]+?):/g;

  text = text.replace(emojiRgx, function (wm, emojiCode) {
    if (emojis.hasOwnProperty(emojiCode)) {
      return emojis[emojiCode];
    }
    return wm;
  });

  return text;
}

function italicsAndBold (text, globals) {
  // it's faster to have 3 separate regexes for each case than have just one
  // because of backtracing, in some cases, it could lead to an exponential effect
  // called "catastrophic backtrace". Ominous!

  function parseInside (txt, left, right) {
    return left + txt + right;
  }

  // Parse underscores
  text = text.replace(/\b___(\S[\s\S]+?)___\b/g, function (wm, txt) {
    return parseInside (txt, '<strong><em>', '</em></strong>');
  });
  text = text.replace(/\b__(\S[\s\S]+?)__\b/g, function (wm, txt) {
    return parseInside (txt, '<strong>', '</strong>');
  });
  text = text.replace(/\b_(\S[\s\S]+?)_\b/g, function (wm, txt) {
    return parseInside (txt, '<em>', '</em>');
  });

  // Now parse asterisks
  text = text.replace(/\*\*\*(\S[\s\S]+?)\*\*\*/g, function (wm, txt) {
    return parseInside (txt, '<strong><em>', '</em></strong>');
  });
  text = text.replace(/\*\*(\S[\s\S]+?)\*\*/g, function (wm, txt) {
    return parseInside (txt, '<strong>', '</strong>');
  });
  text = text.replace(/\*(\S[\s\S]+?)\*/g, function (wm, txt) {
    return parseInside (txt, '<em>', '</em>');
  });

  return text;
}

//TODO what to do?
// function underline (text, globals) {

//   text = text.replace(/\b___(\S[\s\S]+?)___\b/g, function (wm, txt) {
//     return '<u>' + txt + '</u>';
//   });
//   text = text.replace(/\b__(\S[\s\S]+?)__\b/g, function (wm, txt) {
//     return '<u>' + txt + '</u>';
//   });

//   return text;
// }

function strikethrough (text, globals) {

  text = text.replace(/(?:~){2}([\s\S]+?)(?:~){2}/g, function (wm, txt) { return '<del>' + txt + '</del>'; });

  return text;
}

function ellipsis (text, globals) {

  text = text.replace(/\.\.\./g, '…');

  return text;
}

/**
 * Turn Markdown link shortcuts into XHTML <a> tags.
 */
function horizontalRule (text, globals) {

  var key = hashBlock('<hr />', globals);
  text = text.replace(/^ {0,2}( ?-){3,}[ \t]*$/gm, key);
  text = text.replace(/^ {0,2}( ?\*){3,}[ \t]*$/gm, key);
  text = text.replace(/^ {0,2}( ?_){3,}[ \t]*$/gm, key);

  return text;
}

/**
 * Form HTML ordered (numbered) and unordered (bulleted) lists.
 */
function lists (text, globals) {

  /**
   * Process the contents of a single ordered or unordered list, splitting it
   * into individual list items.
   * @param {string} listStr
   * @param {boolean} trimTrailing
   * @returns {string}
   */
  function processListItems (listStr, trimTrailing) {
    // The $g_list_level global keeps track of when we're inside a list.
    // Each time we enter a list, we increment it; when we leave a list,
    // we decrement. If it's zero, we're not in a list anymore.
    //
    // We do this because when we're not inside a list, we want to treat
    // something like this:
    //
    //    I recommend upgrading to version
    //    8. Oops, now this line is treated
    //    as a sub-list.
    //
    // As a single paragraph, despite the fact that the second line starts
    // with a digit-period-space sequence.
    //
    // Whereas when we're inside a list (or sub-list), that line will be
    // treated as the start of a sub-list. What a kludge, huh? This is
    // an aspect of Markdown's syntax that's hard to parse perfectly
    // without resorting to mind-reading. Perhaps the solution is to
    // change the syntax rules such that sub-lists must start with a
    // starting cardinal number; e.g. "1." or "a.".
    globals.gListLevel++;

    // trim trailing blank lines:
    listStr = listStr.replace(/\n{2,}$/, '\n');

    // attacklab: add sentinel to emulate \z
    listStr += '¨0';

    var rgx = new RegExp('(\n)?(^ {0,'+tab_width_limit+'})([*+-]|\\d+[.])[ \t]+((\\[(x|X| )?])?[ \t]*[^\r]+?(\n{1,2}))(?=\n*(¨0| {0,'+tab_width_limit+'}([*+-]|\\d+[.])[ \t]+))', 'gm'),
        isParagraphed = (/\n[ \t]*\n(?!¨0)/.test(listStr));

    listStr = listStr.replace(rgx, function (wholeMatch, m1, m2, m3, m4, taskbtn, checked) {
      checked = (checked && checked.trim() !== '');

      var item = outdent(m4, globals),
          bulletStyle = '';

      // Support for github tasklists
      if (taskbtn) {
        bulletStyle = ' class="task-list-item" style="list-style-type: none;"';
        item = item.replace(/^[ \t]*\[(x|X| )?]/m, function () {
          var otp = '<input type="checkbox" disabled style="margin: 0px 0.35em 0.25em -1.6em; vertical-align: middle;"';
          if (checked) {
            otp += ' checked';
          }
          otp += '>';
          return otp;
        });
      }

      // ISSUE #312
      // This input: - - - a
      // causes trouble to the parser, since it interprets it as:
      // <ul><li><li><li>a</li></li></li></ul>
      // instead of:
      // <ul><li>- - a</li></ul>
      // So, to prevent it, we will put a marker (¨A)in the beginning of the line
      // Kind of hackish/monkey patching, but seems more effective than overcomplicating the list parser
      item = item.replace(/^([-*+]|\d\.)[ \t]+[\S\n ]*/g, function (wm2) {
        return '¨A' + wm2;
      });

      // SPECIAL CASE: an heading followed by a paragraph of text that is not separated by a double newline
      // or/nor indented. ex:
      //
      // - # foo
      // bar is great
      //
      // While this does now follow the spec per se, not allowing for this might cause confusion since
      // header blocks don't need double newlines after
      if (/^#+.+\n.+/.test(item)) {
        item = item.replace(/^(#+.+)$/m, '$1\n');
      }

      // m1 - Leading line or
      // Has a double return (multi paragraph)
      if (m1 || (item.search(/\n{2,}/) > -1)) {
        item = githubCodeBlocks(item, globals);
        item = blockGamut(item, globals);
      } else {

        // Recursion for sub-lists:
        item = lists(item, globals);
        item = item.replace(/\n$/, ''); // chomp(item)
        item = hashHTMLBlocks(item, globals);

        // Colapse double linebreaks
        item = item.replace(/\n\n+/g, '\n\n');

        if (isParagraphed) {
          item = paragraphs(item, globals);
        } else {
          item = spanGamut(item, globals);
        }
      }

      // now we need to remove the marker (¨A)
      item = item.replace('¨A', '');
      // we can finally wrap the line in list item tags
      item =  '<li' + bulletStyle + '>' + item + '</li>\n';

      return item;
    });

    // attacklab: strip sentinel
    listStr = listStr.replace(/¨0/g, '');

    globals.gListLevel--;

    if (trimTrailing) {
      listStr = listStr.replace(/\s+$/, '');
    }

    return listStr;
  }

  function styleStartNumber (list, listType) {
    // check if ol and starts by a number different than 1
    if (listType === 'ol') {
      var res = list.match(/^ *(\d+)\./);
      if (res && res[1] !== '1') {
        return ' start="' + res[1] + '"';
      }
    }
    return '';
  }

  /**
   * Check and parse consecutive lists (better fix for issue #142)
   * @param {string} list
   * @param {string} listType
   * @param {boolean} trimTrailing
   * @returns {string}
   */
  function parseConsecutiveLists (list, listType, trimTrailing) {
    // check if we caught 2 or more consecutive lists by mistake
    // we use the counterRgx, meaning if listType is UL we look for OL and vice versa
    var olRgx = /^ ?\d+\.[ \t]/gm,
        ulRgx = /^ ?[*+-][ \t]/gm,
        counterRxg = (listType === 'ul') ? olRgx : ulRgx,
        result = '';

    if (list.search(counterRxg) !== -1) {
      (function parseCL (txt) {
        var pos = txt.search(counterRxg),
            style = styleStartNumber(list, listType);
        if (pos !== -1) {
          // slice
          result += '\n\n<' + listType + style + '>\n' + processListItems(txt.slice(0, pos), !!trimTrailing) + '</' + listType + '>\n';

          // invert counterType and listType
          listType = (listType === 'ul') ? 'ol' : 'ul';
          counterRxg = (listType === 'ul') ? olRgx : ulRgx;

          //recurse
          parseCL(txt.slice(pos));
        } else {
          result += '\n\n<' + listType + style + '>\n' + processListItems(txt, !!trimTrailing) + '</' + listType + '>\n';
        }
      })(list);
    } else {
      var style = styleStartNumber(list, listType);
      result = '\n\n<' + listType + style + '>\n' + processListItems(list, !!trimTrailing) + '</' + listType + '>\n';
    }

    return result;
  }

  // Start of list parsing
  var subListRgx = new RegExp('^(( {0,'+tab_width_limit+'}([*+-]|\\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\\S)(?![ \t]*(?:[*+-]|\\d+[.])[ \t]+)))', 'gm');
  var mainListRgx = new RegExp('(\n\n|^\n?)(( {0,'+tab_width_limit+'}([*+-]|\\d+[.])[ \t]+)[^\r]+?(¨0|\n{2,}(?=\\S)(?![ \t]*(?:[*+-]|\\d+[.])[ \t]+)))', 'gm');

  // add sentinel to hack around khtml/safari bug:
  // http://bugs.webkit.org/show_bug.cgi?id=11231
  text += '¨0';

  if (globals.gListLevel) {
    text = text.replace(subListRgx, function (wholeMatch, list, m2) {
      var listType = (m2.search(/[*+-]/g) > -1) ? 'ul' : 'ol';
      return parseConsecutiveLists(list, listType, true);
    });
  } else {
    text = text.replace(mainListRgx, function (wholeMatch, m1, list, m3) {
      var listType = (m3.search(/[*+-]/g) > -1) ? 'ul' : 'ol';
      return parseConsecutiveLists(list, listType, false);
    });
  }

  // strip sentinel
  text = text.replace(/¨0/, '');
  return text;
}

/**
 * Remove one level of line-leading tabs or spaces
 */
function outdent (text, globals) {

  // attacklab: hack around Konqueror 3.5.4 bug:
  // "----------bug".replace(/^-/g,"") == "bug"
  text = text.replace(new RegExp('^(\t|[ ]{1,' + tab_width + '})', 'gm'), '¨0'); // attacklab: g_tab_width

  // attacklab: clean up hack
  text = text.replace(/¨0/g, '');

  return text;
}

/**
 *
 */
function paragraphs (text, globals) {
  // Strip leading and trailing lines:
  text = text.replace(/^\n+/g, '');
  text = text.replace(/\n+$/g, '');

  var grafs = text.split(/\n{2,}/g),
      grafsOut = [],
      end = grafs.length; // Wrap <p> tags

  for (var i = 0; i < end; i++) {
    var str = grafs[i];
    // if this is an HTML marker, copy it
    if (str.search(/¨(K|G)(\d+)\1/g) >= 0) {
      grafsOut.push(str);

    // test for presence of characters to prevent empty lines being parsed
    // as paragraphs (resulting in undesired extra empty paragraphs)
    } else if (str.search(/\S/) >= 0) {
      str = spanGamut(str, globals);
      str = str.replace(/^([ \t]*)/g, '<p>');
      str += '</p>';
      grafsOut.push(str);
    }
  }

  /** Unhashify HTML blocks */
  end = grafsOut.length;
  for (i = 0; i < end; i++) {
    var blockText = '',
        grafsOutIt = grafsOut[i],
        codeFlag = false;
    // if this is a marker for an html block...
    // use RegExp.test instead of string.search because of QML bug
    while (/¨(K|G)(\d+)\1/.test(grafsOutIt)) {
      var delim = RegExp.$1,
          num   = RegExp.$2;

      if (delim === 'K') {
        blockText = globals.gHtmlBlocks[num];
      } else {
        // we need to check if ghBlock is a false positive
        if (codeFlag) {
          // use encoded version of all text
          blockText = encodeCode(globals.ghCodeBlocks[num].text, globals);
        } else {
          blockText = globals.ghCodeBlocks[num].codeblock;
        }
      }
      blockText = blockText.replace(/\$/g, '$$$$'); // Escape any dollar signs

      grafsOutIt = grafsOutIt.replace(/(\n\n)?¨(K|G)\d+\2(\n\n)?/, blockText);
      // Check if grafsOutIt is a pre->code
      if (/^<pre\b[^>]*>\s*<code\b[^>]*>/.test(grafsOutIt)) {
        codeFlag = true;
      }
    }
    grafsOut[i] = grafsOutIt;
  }
  text = grafsOut.join('\n');
  // Strip leading and trailing lines:
  text = text.replace(/^\n+/g, '');
  text = text.replace(/\n+$/g, '');

  return text;
}

/**
 * Swap back in all the special characters we've hidden.
 */
function unescapeSpecialChars (text, globals) {

  text = text.replace(/¨E(\d+)E/g, function (wholeMatch, m1) {
    var charCodeToReplace = parseInt(m1);
    return String.fromCharCode(charCodeToReplace);
  });

  return text;
}

/**
 * Process Markdown `<pre><code>` blocks.
 */
function codeBlocks (text, globals) {

  // sentinel workarounds for lack of \A and \Z, safari\khtml bug
  text += '¨0';

  var pattern = new RegExp('(?:\n\n|^)((?:(?:[ ]{' + tab_width + '}|\t).*\n+)+)(\n*[ ]{0,'+tab_width_limit+'}[^ \t\n]|(?=¨0))', 'g');
  text = text.replace(pattern, function (wholeMatch, m1, m2) {
    var codeblock = m1,
        nextChar = m2;

    codeblock = outdent(codeblock, globals);
    codeblock = encodeCode(codeblock, globals);
    codeblock = detab(codeblock, globals);
    codeblock = codeblock.replace(/^\n+/g, ''); // trim leading newlines
    codeblock = codeblock.replace(/\n+$/g, ''); // trim trailing newlines

    codeblock = '<pre><code>' + codeblock + '</code></pre>';

    return hashBlock(codeblock, globals) + nextChar;
  });

  // strip sentinel
  text = text.replace(/¨0/, '');

  return text;
}

function tables (text, globals) {
  var tableRgx       = new RegExp('^ {0,'+tab_width_limit+'}\\|?.+\\|.+\n {0,'+tab_width_limit+'}\\|?[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\\|[ \t]*:?[ \t]*(?:[-=]){2,}[\\s\\S]+?(?:\n\n|¨0)', 'gm'),
      singeColTblRgx = new RegExp('^ {0,'+tab_width_limit+'}\\|.+\\|[ \t]*\n {0,'+tab_width_limit+'}\\|[ \t]*:?[ \t]*(?:[-=]){2,}[ \t]*:?[ \t]*\\|[ \t]*\n( {0,'+tab_width_limit+'}\\|.+\\|[ \t]*\n)*(?:\n|¨0)', 'gm');

  function parseStyles (sLine) {
    if (/^:[ \t]*--*$/.test(sLine)) {
      return ' style="text-align:left;"';
    } else if (/^--*[ \t]*:[ \t]*$/.test(sLine)) {
      return ' style="text-align:right;"';
    } else if (/^:[ \t]*--*[ \t]*:$/.test(sLine)) {
      return ' style="text-align:center;"';
    } else {
      return '';
    }
  }

  function parseHeaders (header, style) {
    header = header.trim();
    header = spanGamut(header, globals);

    return '<th' + style + '>' + header + '</th>\n';
  }

  function parseCells (cell, style) {
    var subText = spanGamut(cell, globals);
    return '<td' + style + '>' + subText + '</td>\n';
  }

  function buildTable (headers, cells) {
    var tb = '<table>\n<thead>\n<tr>\n',
        tblLgn = headers.length;

    for (var i = 0; i < tblLgn; ++i) {
      tb += headers[i];
    }
    tb += '</tr>\n</thead>\n<tbody>\n';

    for (i = 0; i < cells.length; ++i) {
      tb += '<tr>\n';
      for (var ii = 0; ii < tblLgn; ++ii) {
        tb += cells[i][ii];
      }
      tb += '</tr>\n';
    }
    tb += '</tbody>\n</table>\n';
    return tb;
  }

  function parseTable (rawTable) {
    var i, tableLines = rawTable.split('\n');

    for (i = 0; i < tableLines.length; ++i) {
      // strip wrong first and last column if wrapped tables are used
      let rgx = new RegExp('^ {0,'+tab_width_limit+'}\|', '');
      if (rgx.test(tableLines[i])) {
        tableLines[i] = tableLines[i].replace(rgx, '');
      }
      if (/\|[ \t]*$/.test(tableLines[i])) {
        tableLines[i] = tableLines[i].replace(/\|[ \t]*$/, '');
      }
      // parse code spans first, but we only support one line code spans

      tableLines[i] = codeSpans(tableLines[i], globals);
    }

    var rawHeaders = tableLines[0].split('|').map(function (s) { return s.trim();}),
        rawStyles = tableLines[1].split('|').map(function (s) { return s.trim();}),
        rawCells = [],
        headers = [],
        styles = [],
        cells = [];

    tableLines.shift();
    tableLines.shift();

    for (i = 0; i < tableLines.length; ++i) {
      if (tableLines[i].trim() === '') {
        continue;
      }
      rawCells.push(
        tableLines[i]
          .split('|')
          .map(function (s) {
            return s.trim();
          })
      );
    }

    if (rawHeaders.length < rawStyles.length) {
      return rawTable;
    }

    for (i = 0; i < rawStyles.length; ++i) {
      styles.push(parseStyles(rawStyles[i]));
    }

    for (i = 0; i < rawHeaders.length; ++i) {
      if (isUndefined(styles[i])) {
        styles[i] = '';
      }
      headers.push(parseHeaders(rawHeaders[i], styles[i]));
    }

    for (i = 0; i < rawCells.length; ++i) {
      var row = [];
      for (var ii = 0; ii < headers.length; ++ii) {
        if (isUndefined(rawCells[i][ii])) {

        }
        row.push(parseCells(rawCells[i][ii], styles[ii]));
      }
      cells.push(row);
    }

    return buildTable(headers, cells);
  }

  // find escaped pipe characters
  text = text.replace(/\\(\|)/g, escapeCharactersCallback);

  // parse multi column tables
  text = text.replace(tableRgx, parseTable);

  // parse one column tables
  text = text.replace(singeColTblRgx, parseTable);

  return text;
}

export {
  makeHtml
}