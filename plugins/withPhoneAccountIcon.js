const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withPhoneAccountIcon = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const resDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
      
      // Ensure the drawable directory exists
      if (!fs.existsSync(resDir)) {
        fs.mkdirSync(resDir, { recursive: true });
      }

      // File paths
      const iconSource = path.join(projectRoot, 'assets', 'phone_account_icon.png');
      const iconDest = path.join(resDir, 'phone_account_icon.png');

      // Copy the file
      if (fs.existsSync(iconSource)) {
        fs.copyFileSync(iconSource, iconDest);
      } else {
        console.warn('⚠️ No se encontró el icono en assets/phone_account_icon.png');
      }

      return config;
    },
  ]);
};

module.exports = withPhoneAccountIcon;
