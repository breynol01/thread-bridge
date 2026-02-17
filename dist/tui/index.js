import { jsx as _jsx } from "react/jsx-runtime";
import { render } from "ink";
import { App } from "./App.js";
export function launchTui() {
    const { unmount, waitUntilExit } = render(_jsx(App, { onQuit: () => unmount() }), { exitOnCtrlC: true });
    waitUntilExit().then(() => {
        process.exit(0);
    });
}
