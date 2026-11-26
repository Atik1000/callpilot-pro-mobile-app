// Extends app.json. Firebase (needed for incoming-call pushes on Android) is
// wired in only when google-services.json exists, so builds without it still
// work and fall back to the always-on call service.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = './google-services.json';
  if (fs.existsSync(path.join(__dirname, googleServices))) {
    config.android = { ...config.android, googleServicesFile: googleServices };
  }
  return config;
};
