const signed = process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'true';
const notarized = signed && Boolean(process.env.APPLE_TEAM_ID);

const config = {
  "appId": "app.feega.desktop",
  "productName": "Feega",
  "copyright": "Copyright 2026 Feega",
  "asar": true,
  "files": [
    "dist/**",
    "build/icons/**",
    "package.json"
  ],
  "extraResources": [
    {
      "from": "../npx/dist",
      "to": "npx"
    }
  ],
  "directories": {
    "buildResources": "build/icons",
    "output": "release"
  },
  "afterPack": "scripts/ad-hoc-sign.cjs",
  "protocols": [
    {
      "name": "Feega",
      "schemes": [
        "feega"
      ]
    }
  ],
  "mac": {
    "icon": "build/icons/icon.icns",
    "category": "public.app-category.developer-tools",
    "darkModeSupport": true,
    "identity": null,
    "hardenedRuntime": false,
    "gatekeeperAssess": false,
    "artifactName": "Feega-mac-${arch}.${ext}",
    "target": [
      {
        "target": "zip",
        "arch": [
          "arm64",
          "x64"
        ]
      },
      {
        "target": "dmg",
        "arch": [
          "arm64",
          "x64"
        ]
      }
    ]
  },
  "dmg": {
    "artifactName": "Feega-mac-${arch}.${ext}"
  },
  "win": {
    "icon": "build/icons/icon.ico",
    "target": [
      {
        "target": "nsis",
        "arch": [
          "x64"
        ]
      }
    ]
  },
  "nsis": {
    "artifactName": "Feega-win-${arch}.${ext}",
    "oneClick": false,
    "allowToChangeInstallationDirectory": true
  },
  "linux": {
    "icon": "build/icons",
    "category": "Development",
    "mimeTypes": [
      "x-scheme-handler/feega"
    ],
    "target": [
      {
        "target": "AppImage",
        "arch": [
          "x64"
        ]
      }
    ]
  },
  "appImage": {
    "artifactName": "Feega-linux-x64.${ext}"
  },
  "publish": [
    {
      "provider": "generic",
      "url": "https://github.com/andreabuttarelli/feega/releases/download/desktop-latest/"
    }
  ]
};

module.exports = {
  ...config,
  afterPack: signed ? undefined : config.afterPack,
  mac: { ...config.mac, identity: signed ? undefined : null, hardenedRuntime: signed, notarize: notarized }
};
