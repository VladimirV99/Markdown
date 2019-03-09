import encodeCode from './encodeCode';
import detab from './detab';
import hashBlock from './hashBlock';

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
export default function githubCodeBlocks (text, globals) {

  text += '¨0';

  text = text.replace(new RegExp('(?:^|\n)(?: {0,'+globals.tabWidthLimit+'})(```+|~~~+)(?: *)([^\\s`~]*)\n([\\s\\S]*?)\n(?: {0,'+globals.tabWidthLimit+'})\\1', 'g'), function (wholeMatch, delim, language, codeblock) {
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