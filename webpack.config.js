const path = require('path');

let nodeConfig = {
  mode: 'production',
  entry: './src/markdown.js',
  output: {
    filename: 'markdown.node.js',
    path: path.resolve(__dirname, 'build'),
    library: 'markdown',
    libraryTarget: 'umd',
    globalObject: 'this'
  },
  target: 'node'
};

let webConfig = {
  mode: 'production',
  entry: './src/markdown.js',
  output: {
    filename: 'markdown.js',
    path: path.resolve(__dirname, 'build'),
    library: 'markdown',
    libraryTarget: 'var'
  },
  target: 'web'
};

module.exports = [ nodeConfig, webConfig ];