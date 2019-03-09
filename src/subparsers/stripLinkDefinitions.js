import encodeAmpsAndAngles from './encodeAmpsAndAngles';

/**
 * Strips link definitions from text, stores the URLs and titles in
 * hash references.
 * Link defs are in the form: ^[id]: url "optional title"
 */
export default function stripLinkDefinitions (text, globals) {

  let regex       = new RegExp('^ {0,'+globals.tabWidthLimit+'}\\[(.+)]:[ \t]*\n?[ \t]*<?([^>\\s]+)>?(?: =([*\\d]+[A-Za-z%]{0,4})x([*\\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|\'(](.+?)["|\')][ \t]*)?(?:\n+|(?=¨0))', 'gm'),
      base64Regex = new RegExp('^ {0,'+globals.tabWidthLimit+'}\\[(.+)]:[ \t]*\n?[ \t]*<?(data:.+?\/.+?;base64,[A-Za-z0-9+/=\n]+?)>?(?: =([*\\d]+[A-Za-z%]{0,4})x([*\\d]+[A-Za-z%]{0,4}))?[ \t]*\n?[ \t]*(?:(\n*)["|\'(](.+?)["|\')][ \t]*)?(?:\n\n|(?=¨0)|(?=\n\\[))', 'gm');

  // attacklab: sentinel workarounds for lack of \A and \Z, safari\khtml bug
  text += '¨0';

  let replaceFunc = function (wholeMatch, linkId, url, width, height, blankLines, title) {
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