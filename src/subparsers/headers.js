import spanGamut from './spanGamut';
import hashBlock from './hashBlock';

export default function headers (text, globals) {

  let headerLevelStart = 1;

  // Set text-style headers:
  //	Header 1
  //	========
  //
  //	Header 2
  //	--------
  //
  let setextRegexH1 = /^(.+)[ \t]*\n=+[ \t]*\n+/gm;
  let setextRegexH2 = /^(.+)[ \t]*\n-+[ \t]*\n+/gm;

  text = text.replace(setextRegexH1, function (wholeMatch, m1) {
    let headerData = getHeaderData(m1, globals),
        span = spanGamut(headerData.text, globals),
        hLevel = headerLevelStart,
        hashBlockStr = '<h' + hLevel + headerData.id + '>' + span + '</h' + hLevel + '>';
    return hashBlock(hashBlockStr, globals);
  });

  text = text.replace(setextRegexH2, function (wholeMatch, m1) {
    let headerData = getHeaderData(m1, globals),
        span = spanGamut(headerData.text, globals),
        hLevel = headerLevelStart + 1,
        hashBlockStr = '<h' + hLevel + headerData.id + '>' + span + '</h' + hLevel + '>';
    return hashBlock(hashBlockStr, globals);
  });

  // atx-style headers:
  //  # Header 1
  //  ## Header 2
  //  ## Header 2 with closing hashes ##
  //  ...
  //  ###### Header 6
  //
  let atxStyle = new RegExp('^ {0,' + globals.tabWidthLimit + '}(#{1,6})[ \t]+(.+?)[ \t]*#* *\n+', 'gm');

  text = text.replace(atxStyle, function (wholeMatch, m1, m2) {
    let headerData = getHeaderData(m2, globals),
        span = spanGamut(headerData.text, globals),
        hLevel = headerLevelStart - 1 + m1.length,
        header = '<h' + hLevel + headerData.id + '>' + span + '</h' + hLevel + '>';

    return hashBlock(header, globals);
  });

  return text;
}

function getHeaderData (m, globals) {
  let match = m.match(/\s*\{#([^{]+?)}\s*$/); // /(.+)[ \t]+\{#([^{]+?)}(?:\s)*$/
  let id = '';
  let text = m;
  if (match && match[1]) {
    // Prefix id to prevent causing inadvertent pre-existing style matches.
    id = globals.idPrefix + match[1];
    id = id
      .replace(/ /g, '-')
      // replace previously escaped chars (&, ¨ and $)
      .replace(/&amp;/g, '')
      .replace(/¨T/g, '')
      .replace(/¨D/g, '')
      // replace rest of the chars (&~$ are repeated as they might have been escaped)
      // borrowed from github's redcarpet (some they should produce similar results)
      .replace(/[&+$,\/:;=?@"#{}|^¨~\[\]`\\*)(%.!'<>]/g, '')
      .toLowerCase();
    id = ' id="' + id + '"';
    text = m.substring(0, m.length-match[0].length);
  }

  return {
    id: id,
    text: text
  };
}