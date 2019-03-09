import hashBlock from './hashBlock';

/**
 * Turn Markdown link shortcuts into XHTML <a> tags.
 */
export default function horizontalRule (text, globals) {

  let key = hashBlock('<hr />', globals);
  text = text.replace(/^ {0,2}( ?-){3,}[ \t]*$/gm, key);
  text = text.replace(/^ {0,2}( ?\*){3,}[ \t]*$/gm, key);
  text = text.replace(/^ {0,2}( ?_){3,}[ \t]*$/gm, key);

  return text;
}