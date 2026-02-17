import { useInput } from "ink";
import { useState, useCallback } from "react";

export type PanelId = "projects" | "threads" | "messages";

const PANEL_ORDER: PanelId[] = ["projects", "threads", "messages"];

export function useKeyNav(
  onQuit: () => void,
  options?: { enabled?: boolean },
) {
  const [activePanel, setActivePanel] = useState<PanelId>("projects");
  const enabled = options?.enabled ?? true;

  const nextPanel = useCallback(() => {
    setActivePanel((prev) => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx + 1) % PANEL_ORDER.length]!;
    });
  }, []);

  const prevPanel = useCallback(() => {
    setActivePanel((prev) => {
      const idx = PANEL_ORDER.indexOf(prev);
      return PANEL_ORDER[(idx - 1 + PANEL_ORDER.length) % PANEL_ORDER.length]!;
    });
  }, []);

  useInput((input, key) => {
    if (!enabled) return;

    if (input === "q") {
      onQuit();
      return;
    }
    if (key.tab) {
      if (key.shift) {
        prevPanel();
      } else {
        nextPanel();
      }
    }
    // h/l for lateral panel movement
    if (input === "h") prevPanel();
    if (input === "l") nextPanel();
  });

  return { activePanel, setActivePanel };
}
