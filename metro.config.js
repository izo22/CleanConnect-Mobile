const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ajouter les extensions de fichiers d'assets
config.resolver.assetExts.push(
  'ttf',
  'otf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg'
);

module.exports = config;
