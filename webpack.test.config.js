const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/markdown.js',
  output: {
    filename: 'markdown.js',
    path: path.resolve(__dirname, 'test', 'build'),
    library: 'markdown',
    libraryTarget: 'umd'
  },
  target: 'node'
};