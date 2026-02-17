import React from "react";
import { render } from "ink";
import { App } from "./App.js";

export function launchTui() {
  const { unmount, waitUntilExit } = render(
    <App onQuit={() => unmount()} />,
    { exitOnCtrlC: true },
  );

  waitUntilExit().then(() => {
    process.exit(0);
  });
}
