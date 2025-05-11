import { AuthorizationProvider, MessageContext, PermissionCheckResult } from '@magicbutton.cloud/messaging';

/**
 * Permission definition for a component type
 */
interface ComponentPermission {
  // Message types that this component can handle
  canHandle: string[];
  
  // Message types that this component can send
  canSend: string[];
  
  // Whether this component can broadcast messages
  canBroadcast: boolean;
  
  // Additional component-specific permissions
  additionalPermissions?: Record<string, boolean>;
}

/**
 * Configuration for the Chrome extension authorization provider
 */
export interface ExtensionAuthorizationProviderConfig {
  // Permission definitions by component type
  permissions?: {
    background?: ComponentPermission;
    content?: ComponentPermission;
    popup?: ComponentPermission;
    sidepanel?: ComponentPermission;
    options?: ComponentPermission;
    [key: string]: ComponentPermission;
  };
  
  // Whether to allow messages not explicitly defined in permissions
  allowUndefinedMessages?: boolean;
  
  // Whether to enforce origin restrictions for content scripts
  enforceContentScriptOrigins?: boolean;
  
  // Map of allowed origins to message types for content scripts
  contentScriptOriginPermissions?: Record<string, {
    canHandle: string[];
    canSend: string[];
    canBroadcast: boolean;
  }>;
}

/**
 * AuthorizationProvider implementation for Chrome extension components
 * Enforces permissions based on component types and origins
 */
export class ExtensionAuthorizationProvider implements AuthorizationProvider {
  private readonly config: ExtensionAuthorizationProviderConfig;
  
  // Default permissions by component type
  private readonly defaultPermissions: Record<string, ComponentPermission> = {
    // Background script can do everything
    background: {
      canHandle: ['*'],
      canSend: ['*'],
      canBroadcast: true
    },
    
    // Content scripts are restricted by default
    content: {
      canHandle: ['dom:*', 'page:*', 'content:*'],
      canSend: ['page:*', 'dom:*', 'settings:get'],
      canBroadcast: false
    },
    
    // Popup is UI focused
    popup: {
      canHandle: ['ui:*'],
      canSend: ['settings:*', 'ui:*'],
      canBroadcast: false
    },
    
    // Sidepanel similar to popup
    sidepanel: {
      canHandle: ['ui:*', 'panel:*'],
      canSend: ['settings:*', 'panel:*', 'ui:*'],
      canBroadcast: false
    },
    
    // Options page can access all settings
    options: {
      canHandle: ['settings:*', 'options:*'],
      canSend: ['settings:*', 'options:*'],
      canBroadcast: false
    }
  };
  
  constructor(config: ExtensionAuthorizationProviderConfig = {}) {
    // Merge provided permissions with defaults
    const mergedPermissions = { ...this.defaultPermissions };
    
    if (config.permissions) {
      Object.entries(config.permissions).forEach(([componentType, permissions]) => {
        mergedPermissions[componentType] = {
          ...this.defaultPermissions[componentType] || { canHandle: [], canSend: [], canBroadcast: false },
          ...permissions
        };
      });
    }
    
    this.config = {
      permissions: mergedPermissions,
      allowUndefinedMessages: false,
      enforceContentScriptOrigins: true,
      contentScriptOriginPermissions: {},
      ...config
    };
  }
  
  /**
   * Checks if a request or event is permitted based on the message context
   */
  async checkPermission(messageType: string, context: MessageContext, isBroadcast: boolean = false): Promise<PermissionCheckResult> {
    // Get component type from context
    const componentType = context.meta?.componentType as string || 
                        (context.user?.roles?.length ? context.user.roles[0] : 'unknown');
    
    // Get permissions for this component type
    const permissions = this.config.permissions[componentType];
    
    if (!permissions) {
      return {
        isAuthorized: this.config.allowUndefinedMessages,
        error: `No permissions defined for component type: ${componentType}`
      };
    }
    
    // For content scripts, check origin-specific permissions if enabled
    if (this.config.enforceContentScriptOrigins && 
        componentType === 'content' && 
        context.source && 
        Object.keys(this.config.contentScriptOriginPermissions).length > 0) {
      
      // Find matching origin pattern
      const matchingOrigin = Object.keys(this.config.contentScriptOriginPermissions)
        .find(origin => {
          if (origin.includes('*')) {
            const pattern = origin.replace(/\*/g, '.*');
            return new RegExp(`^${pattern}$`).test(context.source);
          }
          return context.source.startsWith(origin);
        });
      
      if (matchingOrigin) {
        const originPermissions = this.config.contentScriptOriginPermissions[matchingOrigin];
        
        // Override default permissions with origin-specific ones
        if (isBroadcast && !originPermissions.canBroadcast) {
          return {
            isAuthorized: false,
            error: `Origin ${context.source} is not allowed to broadcast messages`
          };
        }
        
        const relevantPermissions = isBroadcast ? originPermissions.canSend : 
                                  (messageType.startsWith('request:') ? originPermissions.canHandle : originPermissions.canSend);
        
        // Check if the specific message type is allowed
        if (!isMessageAllowed(messageType, relevantPermissions)) {
          return {
            isAuthorized: false,
            error: `Origin ${context.source} is not allowed to ${isBroadcast ? 'broadcast' : 'send'} message type: ${messageType}`
          };
        }
        
        // Origin-specific permissions granted
        return { isAuthorized: true };
      }
    }
    
    // For broadcasts, check if component can broadcast
    if (isBroadcast && !permissions.canBroadcast) {
      return {
        isAuthorized: false,
        error: `Component type ${componentType} is not allowed to broadcast messages`
      };
    }
    
    // Check regular permissions
    const relevantPermissions = messageType.startsWith('request:') ? 
                              permissions.canHandle : 
                              permissions.canSend;
    
    // Check if the specific message type is allowed
    if (!isMessageAllowed(messageType, relevantPermissions)) {
      return {
        isAuthorized: false,
        error: `Component type ${componentType} is not allowed to ${messageType.startsWith('request:') ? 'handle' : 'send'} message type: ${messageType}`
      };
    }
    
    // Permission granted
    return { isAuthorized: true };
  }
}

/**
 * Helper function to check if a message type is allowed by a list of permitted patterns
 */
function isMessageAllowed(messageType: string, allowedPatterns: string[]): boolean {
  // Wildcard pattern allows all messages
  if (allowedPatterns.includes('*')) {
    return true;
  }
  
  // Check for exact match
  if (allowedPatterns.includes(messageType)) {
    return true;
  }
  
  // Check for wildcard matches (e.g., "settings:*" matches "settings:get")
  return allowedPatterns.some(pattern => {
    if (pattern.endsWith(':*')) {
      const prefix = pattern.slice(0, -1); // Remove the '*'
      return messageType.startsWith(prefix);
    }
    return false;
  });
}