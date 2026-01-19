/**
 * API Key Manager
 *
 * Manages API key creation and retrieval.
 * Automatically creates keys where possible, falls back to user input otherwise.
 *
 * Based on: /home/samuel/sv/.bmad/infrastructure/automatic-secrets-and-api-key-creation.md
 */

import { SecretsManager } from './SecretsManager.js';
import { AutoSecretDetector } from './AutoSecretDetector.js';

/**
 * API key creation options
 */
export interface APIKeyOptions {
  /** Provider name (anthropic, openai, google, stripe, github) */
  provider: string;
  /** Project name (for project-level keys) */
  projectName?: string;
  /** Service name (for service-level keys) */
  serviceName?: string;
  /** Permissions/scopes required */
  permissions?: string[];
  /** Description for the key */
  description?: string;
}

/**
 * API key creation result
 */
export interface APIKeyResult {
  /** The API key */
  apiKey: string;
  /** Key ID (if applicable) */
  keyId?: string;
  /** Whether key was created automatically */
  automated: boolean;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * User input callback
 */
export type UserInputCallback = (question: string) => Promise<string>;

/**
 * API Key Manager
 *
 * Handles automatic API key creation and storage.
 */
export class APIKeyManager {
  private secretsManager: SecretsManager;
  private secretDetector: AutoSecretDetector;
  private userInputCallback?: UserInputCallback;

  /**
   * Supported providers for automatic key creation
   */
  private automatableProviders = new Set([
    'google', 'gemini',
    'stripe',
    'github',
  ]);

  /**
   * Manual providers (require user input)
   */
  private manualProviders = new Set([
    'anthropic', 'claude',
    'openai', 'gpt',
  ]);

  constructor(secretsManager: SecretsManager, userInputCallback?: UserInputCallback) {
    this.secretsManager = secretsManager;
    this.secretDetector = new AutoSecretDetector();
    this.userInputCallback = userInputCallback;
  }

  /**
   * Get or create an API key
   *
   * @param options - API key options
   * @returns API key result
   */
  async getOrCreateAPIKey(options: APIKeyOptions): Promise<APIKeyResult> {
    // Generate key path
    const keyPath = this.generateKeyPath(options);

    // 1. Check if key already exists
    try {
      const existing = await this.secretsManager.get({
        keyPath,
      });

      if (existing) {
        return {
          apiKey: existing,
          automated: false,
          metadata: { cached: true },
        };
      }
    } catch (error) {
      // Key doesn't exist, continue to creation
    }

    // 2. Try automatic creation
    if (this.canCreateAutomatically(options.provider)) {
      return await this.createKeyAutomatically(options);
    }

    // 3. Fall back to user input
    return await this.requestKeyFromUser(options);
  }

  /**
   * Check if provider supports automatic key creation
   */
  canCreateAutomatically(provider: string): boolean {
    return this.automatableProviders.has(provider.toLowerCase());
  }

  /**
   * Create API key automatically
   */
  private async createKeyAutomatically(options: APIKeyOptions): Promise<APIKeyResult> {
    const provider = options.provider.toLowerCase();

    switch (provider) {
      case 'google':
      case 'gemini':
        return await this.createGoogleKey(options);

      case 'stripe':
        return await this.createStripeKey(options);

      case 'github':
        return await this.createGitHubToken(options);

      default:
        throw new Error(`Automatic creation not supported for provider: ${provider}`);
    }
  }

  /**
   * Create Google API key
   *
   * Note: Requires Google Cloud credentials and googleapis package
   */
  private async createGoogleKey(options: APIKeyOptions): Promise<APIKeyResult> {
    // TODO: Implement Google API key creation
    // Requires: googleapis package and service account credentials
    throw new Error('Google API key creation not yet implemented. Please provide key manually.');

    /*
    // Example implementation:
    import { google } from 'googleapis';

    const iam = google.iam('v1');
    const serviceAccount = await iam.projects.serviceAccounts.create({
      name: `projects/${projectId}`,
      requestBody: {
        accountId: `${options.projectName}-api`,
        serviceAccount: {
          displayName: `${options.projectName} API Service Account`
        }
      }
    });

    const key = await iam.projects.serviceAccounts.keys.create({
      name: `projects/${projectId}/serviceAccounts/${serviceAccount.data.email}`,
      requestBody: {
        privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE'
      }
    });

    const keyData = JSON.parse(
      Buffer.from(key.data.privateKeyData, 'base64').toString()
    );

    await this.secretsManager.set({
      keyPath: this.generateKeyPath(options),
      value: keyData.private_key,
      description: options.description || `Google API key for ${options.projectName}`,
    });

    return {
      apiKey: keyData.private_key,
      keyId: key.data.name,
      automated: true,
      metadata: {
        serviceAccountEmail: serviceAccount.data.email
      }
    };
    */
  }

  /**
   * Create Stripe restricted API key
   *
   * Note: Requires stripe package and parent API key
   */
  private async createStripeKey(options: APIKeyOptions): Promise<APIKeyResult> {
    // TODO: Implement Stripe key creation
    // Requires: stripe package and parent secret key
    throw new Error('Stripe API key creation not yet implemented. Please provide key manually.');

    /*
    // Example implementation:
    import Stripe from 'stripe';

    const stripe = new Stripe(parentSecretKey);
    const key = await stripe.restrictedKeys.create({
      name: `${options.projectName}-api`,
      resources: {
        'charges': { permissions: options.permissions?.includes('charges') ? ['write'] : [] },
        'customers': { permissions: options.permissions?.includes('customers') ? ['write'] : [] },
        'subscriptions': { permissions: options.permissions?.includes('subscriptions') ? ['write'] : [] }
      }
    });

    await this.secretsManager.set({
      keyPath: this.generateKeyPath(options),
      value: key.secret,
      description: options.description || `Stripe API key for ${options.projectName}`,
    });

    return {
      apiKey: key.secret,
      keyId: key.id,
      automated: true,
      metadata: {
        restricted: true,
        permissions: options.permissions
      }
    };
    */
  }

  /**
   * Create GitHub installation token
   *
   * Note: Requires @octokit/rest package and GitHub App credentials
   */
  private async createGitHubToken(options: APIKeyOptions): Promise<APIKeyResult> {
    // TODO: Implement GitHub token creation
    // Requires: @octokit/rest package and GitHub App setup
    throw new Error('GitHub token creation not yet implemented. Please provide token manually.');

    /*
    // Example implementation:
    import { Octokit } from '@octokit/rest';

    const octokit = new Octokit({ auth: appToken });
    const response = await octokit.apps.createInstallationAccessToken({
      installation_id: installationId,
      repositories: options.permissions || [],
      permissions: {
        contents: 'write',
        issues: 'write',
        pull_requests: 'write'
      }
    });

    await this.secretsManager.set({
      keyPath: this.generateKeyPath(options),
      value: response.data.token,
      description: options.description || `GitHub token for ${options.projectName}`,
      expiresAt: new Date(response.data.expires_at),
    });

    return {
      apiKey: response.data.token,
      automated: true,
      metadata: {
        expiresAt: response.data.expires_at
      }
    };
    */
  }

  /**
   * Request API key from user
   */
  private async requestKeyFromUser(options: APIKeyOptions): Promise<APIKeyResult> {
    if (!this.userInputCallback) {
      throw new Error('User input callback not configured');
    }

    // Generate helpful question with link
    const question = this.generateUserQuestion(options);

    // Ask user for key
    const answer = await this.userInputCallback(question);

    // Detect and validate
    const detection = this.secretDetector.detectSecret(answer, {
      question,
      projectName: options.projectName,
      serviceName: options.serviceName,
    });

    if (!detection) {
      throw new Error('Could not detect valid API key in provided input');
    }

    // Store the key
    await this.secretsManager.set({
      keyPath: detection.keyPath,
      value: detection.value,
      description: options.description || detection.description,
    });

    return {
      apiKey: detection.value,
      automated: false,
      metadata: {
        detectedType: detection.type,
        confidence: detection.confidence,
      },
    };
  }

  /**
   * Generate user question for manual key input
   */
  private generateUserQuestion(options: APIKeyOptions): string {
    const provider = options.provider;
    const project = options.projectName ? ` for ${options.projectName}` : '';

    // Provider-specific instructions
    const instructions: Record<string, string> = {
      'anthropic': 'Create one at: https://console.anthropic.com/settings/keys',
      'claude': 'Create one at: https://console.anthropic.com/settings/keys',
      'openai': 'Create one at: https://platform.openai.com/api-keys',
      'gpt': 'Create one at: https://platform.openai.com/api-keys',
      'google': 'Create one at: https://console.cloud.google.com/apis/credentials',
      'gemini': 'Create one at: https://aistudio.google.com/app/apikey',
      'stripe': 'Create one at: https://dashboard.stripe.com/apikeys',
      'github': 'Create one at: https://github.com/settings/tokens',
      'cloudflare': 'Create one at: https://dash.cloudflare.com/profile/api-tokens',
    };

    const instruction = instructions[provider.toLowerCase()] || '';

    return `I need a ${provider} API key${project}.

${instruction ? instruction + '\n\n' : ''}Paste your ${provider} API key:`;
  }

  /**
   * Generate key path for storage
   */
  private generateKeyPath(options: APIKeyOptions): string {
    const provider = options.provider.toLowerCase();

    // Meta-level providers
    const metaProviders = [
      'anthropic', 'claude',
      'openai', 'gpt',
      'google', 'gemini',
      'github',
      'cloudflare',
    ];

    if (metaProviders.includes(provider)) {
      // Normalize provider name
      let normalizedProvider = provider;
      if (provider === 'claude') normalizedProvider = 'anthropic';
      if (provider === 'gpt') normalizedProvider = 'openai';
      if (provider === 'gemini') normalizedProvider = 'google';

      return `meta/${normalizedProvider}/api_key`;
    }

    // Project-level providers
    if (options.projectName) {
      return `project/${options.projectName}/${provider}_api_key`;
    }

    // Fallback
    return `meta/${provider}/api_key`;
  }

  /**
   * Set user input callback
   */
  setUserInputCallback(callback: UserInputCallback): void {
    this.userInputCallback = callback;
  }
}
