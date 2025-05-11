import { AuthProvider, MessageContext, AuthResult } from '@magicbutton.cloud/messaging';

/**
 * Configuration for the Chrome extension authentication provider
 */
export interface ExtensionAuthProviderConfig {
  // Whether to require origin checking for content scripts
  requireOriginCheck?: boolean;
  
  // List of allowed origins for content scripts
  allowedOrigins?: string[];
  
  // Whether to require component type checking
  requireComponentTypeCheck?: boolean;
  
  // List of allowed component types
  allowedComponentTypes?: ('background' | 'content' | 'popup' | 'sidepanel' | 'options')[];
  
  // Function to validate extension-specific auth tokens if needed
  tokenValidator?: (token: string) => Promise<boolean>;
  
  // Extension ID to validate
  extensionId?: string;
}

/**
 * AuthProvider implementation for Chrome extension components
 * Validates component authentication based on Chrome extension security model
 */
export class ExtensionAuthProvider implements AuthProvider {
  private readonly config: ExtensionAuthProviderConfig;
  
  constructor(config: ExtensionAuthProviderConfig) {
    this.config = {
      requireOriginCheck: true,
      allowedOrigins: [],
      requireComponentTypeCheck: true,
      allowedComponentTypes: ['background', 'content', 'popup', 'sidepanel', 'options'],
      ...config
    };
  }
  
  /**
   * Authenticates a message based on its context
   */
  async authenticate(context: MessageContext): Promise<AuthResult> {
    // Check if valid extension ID (if configured)
    if (this.config.extensionId && context.user?.id !== this.config.extensionId) {
      return {
        isAuthenticated: false,
        error: 'Invalid extension ID'
      };
    }
    
    // Check component type (if required)
    if (this.config.requireComponentTypeCheck && context.meta?.componentType) {
      const componentType = context.meta.componentType as string;
      
      if (!this.config.allowedComponentTypes.includes(componentType as any)) {
        return {
          isAuthenticated: false,
          error: `Component type not allowed: ${componentType}`
        };
      }
    }
    
    // Check origin for content scripts (if required)
    if (this.config.requireOriginCheck && 
        context.meta?.componentType === 'content' && 
        context.source) {
      
      const sourceUrl = context.source;
      let isAllowed = false;
      
      // Check against allowed origins
      if (this.config.allowedOrigins.length > 0) {
        isAllowed = this.config.allowedOrigins.some(origin => {
          if (origin.includes('*')) {
            // Handle wildcard patterns (e.g., "https://*.example.com/*")
            const pattern = origin.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(sourceUrl);
          }
          return sourceUrl.startsWith(origin);
        });
      } else {
        // If no specific origins are defined, allow all
        isAllowed = true;
      }
      
      if (!isAllowed) {
        return {
          isAuthenticated: false,
          error: `Origin not allowed: ${sourceUrl}`
        };
      }
    }
    
    // Check token if validator is provided
    if (this.config.tokenValidator && context.meta?.token) {
      const isValidToken = await this.config.tokenValidator(context.meta.token as string);
      
      if (!isValidToken) {
        return {
          isAuthenticated: false,
          error: 'Invalid authentication token'
        };
      }
    }
    
    // Authentication successful
    return {
      isAuthenticated: true,
      user: {
        id: context.user?.id || 'anonymous',
        // Include component type as a role for easier authorization
        roles: [context.meta?.componentType as string || 'unknown']
      }
    };
  }
}