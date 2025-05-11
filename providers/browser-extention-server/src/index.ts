// Export main components
export { ChromeExtensionTransport, ChromeExtensionTransportConfig } from './chrome-extension-transport';
export { ChromeExtensionTransportFactory } from './chrome-extension-transport-factory';
export { ChromeExtensionServerFactory, ChromeExtensionServerConfig } from './chrome-extension-server-factory';

// Export configuration helpers
export {
  createBackgroundConfig,
  createContentScriptConfig,
  createPopupConfig,
  createSidePanelConfig,
  createOptionsConfig
} from './component-configs';

// Export security components
export {
  ExtensionAuthProvider,
  ExtensionAuthProviderConfig,
  ExtensionAuthorizationProvider,
  ExtensionAuthorizationProviderConfig,
  ExtensionAuthProviderFactory,
  ExtensionAuthorizationProviderFactory
} from './security';