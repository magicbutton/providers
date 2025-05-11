import { AuthProviderFactory, AuthorizationProviderFactory } from '@magicbutton.cloud/messaging';
import { 
  ExtensionAuthProvider, 
  ExtensionAuthProviderConfig 
} from './extension-auth-provider';
import { 
  ExtensionAuthorizationProvider, 
  ExtensionAuthorizationProviderConfig 
} from './extension-authorization-provider';

/**
 * Factory for creating Chrome extension auth providers
 */
export class ExtensionAuthProviderFactory implements AuthProviderFactory {
  create(config: any): ExtensionAuthProvider {
    return new ExtensionAuthProvider(config as ExtensionAuthProviderConfig);
  }
}

/**
 * Factory for creating Chrome extension authorization providers
 */
export class ExtensionAuthorizationProviderFactory implements AuthorizationProviderFactory {
  create(config: any): ExtensionAuthorizationProvider {
    return new ExtensionAuthorizationProvider(config as ExtensionAuthorizationProviderConfig);
  }
}

// Export all security-related types and classes
export {
  ExtensionAuthProvider,
  ExtensionAuthProviderConfig,
  ExtensionAuthorizationProvider,
  ExtensionAuthorizationProviderConfig
};