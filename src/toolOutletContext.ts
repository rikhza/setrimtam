/** Passed from Layout via <Outlet context> for tool pages that register a global Clear action. */
export type ToolsOutletContext = {
  registerClearAll: (fn: (() => void) | null) => void;
};
