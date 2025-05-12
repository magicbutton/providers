// Extend Chrome types for Side Panel API
declare namespace chrome {
  namespace sidePanel {
    interface SidePanelOptions {
      path?: string;
      enabled?: boolean;
      width?: number;
    }

    function open(options?: SidePanelOptions): Promise<void>;
    function close(): Promise<void>;
    function setOptions(options: SidePanelOptions): Promise<void>;
    function getOptions(): Promise<SidePanelOptions>;
  }
}