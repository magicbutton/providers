import { ChromeExtensionServerConfig } from './chrome-extension-server-factory';

/**
 * Creates a default configuration for a background script server
 */
export function createBackgroundConfig(options: {
  namespace?: string;
  heartbeatInterval?: number;
  middlewareConfig?: any;
  observabilityConfig?: any;
} = {}): ChromeExtensionServerConfig {
  return {
    componentType: 'background',
    namespace: options.namespace || 'magicbutton',
    transportConfig: {
      componentType: 'background'
    },
    middlewareConfig: options.middlewareConfig || {
      validation: true,
      logging: true
    },
    observabilityConfig: options.observabilityConfig,
    extensionOptions: {
      handleSystemEvents: true,
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds default
      useLongLivedConnections: true
    }
  };
}

/**
 * Creates a default configuration for a content script server
 */
export function createContentScriptConfig(options: {
  namespace?: string;
  targetTabId?: number;
  autoConnectToBackground?: boolean;
  middlewareConfig?: any;
  observabilityConfig?: any;
} = {}): ChromeExtensionServerConfig {
  return {
    componentType: 'content',
    namespace: options.namespace || 'magicbutton',
    targetTabId: options.targetTabId,
    transportConfig: {
      componentType: 'content',
      targetTabId: options.targetTabId
    },
    middlewareConfig: options.middlewareConfig || {
      validation: true,
      logging: true
    },
    observabilityConfig: options.observabilityConfig,
    extensionOptions: {
      autoConnectToBackground: options.autoConnectToBackground !== false,
      useLongLivedConnections: false
    }
  };
}

/**
 * Creates a default configuration for a popup script server
 */
export function createPopupConfig(options: {
  namespace?: string;
  autoConnectToBackground?: boolean;
  middlewareConfig?: any;
  observabilityConfig?: any;
} = {}): ChromeExtensionServerConfig {
  return {
    componentType: 'popup',
    namespace: options.namespace || 'magicbutton',
    transportConfig: {
      componentType: 'popup'
    },
    middlewareConfig: options.middlewareConfig || {
      validation: true,
      logging: true
    },
    observabilityConfig: options.observabilityConfig,
    extensionOptions: {
      autoConnectToBackground: options.autoConnectToBackground !== false,
      // Popups are short-lived, so long connections might not be ideal
      useLongLivedConnections: false
    }
  };
}

/**
 * Creates a default configuration for a side panel script server
 */
export function createSidePanelConfig(options: {
  namespace?: string;
  autoConnectToBackground?: boolean;
  middlewareConfig?: any;
  observabilityConfig?: any;
} = {}): ChromeExtensionServerConfig {
  return {
    componentType: 'sidepanel',
    namespace: options.namespace || 'magicbutton',
    transportConfig: {
      componentType: 'sidepanel'
    },
    middlewareConfig: options.middlewareConfig || {
      validation: true,
      logging: true
    },
    observabilityConfig: options.observabilityConfig,
    extensionOptions: {
      autoConnectToBackground: options.autoConnectToBackground !== false,
      // Side panels are longer-lived, so connections make sense
      useLongLivedConnections: true
    }
  };
}

/**
 * Creates a default configuration for an options page script server
 */
export function createOptionsConfig(options: {
  namespace?: string;
  autoConnectToBackground?: boolean;
  middlewareConfig?: any;
  observabilityConfig?: any;
} = {}): ChromeExtensionServerConfig {
  return {
    componentType: 'options',
    namespace: options.namespace || 'magicbutton',
    transportConfig: {
      componentType: 'options'
    },
    middlewareConfig: options.middlewareConfig || {
      validation: true,
      logging: true
    },
    observabilityConfig: options.observabilityConfig,
    extensionOptions: {
      autoConnectToBackground: options.autoConnectToBackground !== false,
      // Options pages are longer-lived, so connections make sense
      useLongLivedConnections: true
    }
  };
}