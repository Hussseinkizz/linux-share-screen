import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "Screen Share",
		identifier: "dev.linuxscreenshare.app",
		version: "1.0.0",
	},
	build: {
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
			"resources": "resources",
		},
		watchIgnore: ["resources", "docs"],
		linux: {
			bundleCEF: false,
			defaultRenderer: "native",
			icon: "assets/icon.png",
		},
	},
} satisfies ElectrobunConfig;
