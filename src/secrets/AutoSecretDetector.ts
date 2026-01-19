/**
 * Auto Secret Detector
 *
 * Automatically detects API keys and secrets in user messages.
 * Uses pattern matching and context-based detection.
 *
 * Based on: /home/samuel/sv/.bmad/infrastructure/automatic-secrets-and-api-key-creation.md
 */

/**
 * Detected secret information
 */
export interface SecretDetection {
  /** Type of secret detected */
  type: string;
  /** The secret value */
  value: string;
  /** Suggested key path for storage */
  keyPath: string;
  /** Human-readable description */
  description: string;
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Detection context
 */
export interface DetectionContext {
  /** The question/prompt that was asked */
  question?: string;
  /** Current project name */
  projectName?: string;
  /** Current service name */
  serviceName?: string;
}

/**
 * Auto Secret Detector
 *
 * Detects API keys and secrets automatically from user input.
 */
export class AutoSecretDetector {
  /**
   * Regex patterns for common API keys and secrets
   */
  private patterns: Record<string, RegExp> = {
    // Anthropic API keys
    anthropic: /^sk-ant-api03-[a-zA-Z0-9-_]{95,}$/,

    // OpenAI API keys
    openai: /^sk-[a-zA-Z0-9]{48}$/,
    openai_org: /^org-[a-zA-Z0-9]{24}$/,
    openai_project: /^proj_[a-zA-Z0-9]{24,}$/,

    // Google/Gemini API keys
    google_api: /^AIza[0-9A-Za-z-_]{35}$/,

    // Stripe API keys
    stripe_live_secret: /^sk_live_[a-zA-Z0-9]{24,}$/,
    stripe_test_secret: /^sk_test_[a-zA-Z0-9]{24,}$/,
    stripe_live_publishable: /^pk_live_[a-zA-Z0-9]{24,}$/,
    stripe_test_publishable: /^pk_test_[a-zA-Z0-9]{24,}$/,
    stripe_restricted: /^rk_(live|test)_[a-zA-Z0-9]{24,}$/,

    // GitHub tokens
    github_pat: /^ghp_[a-zA-Z0-9]{36}$/,
    github_oauth: /^gho_[a-zA-Z0-9]{36}$/,
    github_app: /^(ghu|ghs)_[a-zA-Z0-9]{36}$/,
    github_refresh: /^ghr_[a-zA-Z0-9]{36}$/,

    // Cloudflare
    cloudflare_api_token: /^[a-zA-Z0-9_-]{40}$/,
    cloudflare_api_key: /^[a-f0-9]{37}$/,

    // AWS
    aws_access_key: /^AKIA[0-9A-Z]{16}$/,
    aws_secret_key: /^[a-zA-Z0-9/+=]{40}$/,

    // Database URLs
    postgres: /^postgres(ql)?:\/\/.+$/,
    mongodb: /^mongodb(\+srv)?:\/\/.+$/,
    mysql: /^mysql:\/\/.+$/,
    redis: /^redis:\/\/.+$/,

    // Generic patterns (lower confidence)
    jwt_token: /^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/,
    bearer_token: /^Bearer\s+[a-zA-Z0-9_-]{20,}$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  };

  /**
   * Detect if a string is likely a secret
   *
   * @param value - The string to check
   * @param context - Optional context for better detection
   * @returns SecretDetection if detected, null otherwise
   */
  detectSecret(value: string, context?: DetectionContext): SecretDetection | null {
    // Trim whitespace
    value = value.trim();

    // Skip empty or very short strings
    if (value.length < 10) {
      return null;
    }

    // Test against all patterns
    for (const [type, pattern] of Object.entries(this.patterns)) {
      if (pattern.test(value)) {
        const confidence = this.calculateConfidence(type, value, context);

        return {
          type,
          value,
          keyPath: this.generateKeyPath(type, context),
          description: this.generateDescription(type, context),
          confidence,
        };
      }
    }

    // Context-based detection (if pattern doesn't match)
    if (context?.question) {
      const contextDetection = this.detectFromContext(value, context);
      if (contextDetection) {
        return contextDetection;
      }
    }

    return null;
  }

  /**
   * Detect secret from context (question keywords)
   */
  private detectFromContext(value: string, context: DetectionContext): SecretDetection | null {
    const question = context.question!.toLowerCase();

    // Keywords in question
    const keywordMap: Record<string, string> = {
      'anthropic': 'anthropic',
      'claude': 'anthropic',
      'openai': 'openai',
      'gpt': 'openai',
      'google': 'google_api',
      'gemini': 'google_api',
      'stripe': 'stripe_api',
      'github': 'github_token',
      'cloudflare': 'cloudflare_api',
      'aws': 'aws_credential',
      'database': 'database_url',
      'postgres': 'postgres',
      'mongodb': 'mongodb',
      'mysql': 'mysql',
      'redis': 'redis',
    };

    for (const [keyword, type] of Object.entries(keywordMap)) {
      if (question.includes(keyword)) {
        // Additional checks for "api key" or "token"
        if (question.includes('api key') || question.includes('token') ||
            question.includes('secret') || question.includes('password') ||
            question.includes('credential')) {

          return {
            type,
            value,
            keyPath: this.generateKeyPath(type, context),
            description: this.generateDescription(type, context),
            confidence: 0.7, // Medium confidence from context
          };
        }
      }
    }

    // Generic password/secret detection
    if (question.includes('password') && value.length >= 8) {
      return {
        type: 'password',
        value,
        keyPath: this.generateKeyPath('password', context),
        description: this.generateDescription('password', context),
        confidence: 0.6,
      };
    }

    // Generic API key detection
    if ((question.includes('api key') || question.includes('token')) && value.length >= 20) {
      return {
        type: 'api_key',
        value,
        keyPath: this.generateKeyPath('api_key', context),
        description: this.generateDescription('api_key', context),
        confidence: 0.5,
      };
    }

    return null;
  }

  /**
   * Calculate confidence level for detection
   */
  private calculateConfidence(type: string, value: string, context?: DetectionContext): number {
    // High confidence for specific patterns
    const highConfidenceTypes = [
      'anthropic', 'openai', 'openai_org', 'openai_project',
      'google_api', 'stripe_live_secret', 'stripe_test_secret',
      'github_pat', 'github_oauth', 'aws_access_key'
    ];

    if (highConfidenceTypes.includes(type)) {
      return 1.0;
    }

    // Medium confidence for less specific patterns
    const mediumConfidenceTypes = [
      'stripe_restricted', 'github_app', 'cloudflare_api_token',
      'postgres', 'mongodb', 'mysql', 'redis'
    ];

    if (mediumConfidenceTypes.includes(type)) {
      return 0.8;
    }

    // Lower confidence for generic patterns
    return 0.6;
  }

  /**
   * Generate appropriate key path based on type and context
   */
  private generateKeyPath(type: string, context?: DetectionContext): string {
    const project = context?.projectName;
    const service = context?.serviceName;

    // Meta-level secrets (shared across all projects)
    const metaTypes: Record<string, string> = {
      'anthropic': 'meta/anthropic/api_key',
      'openai': 'meta/openai/api_key',
      'openai_org': 'meta/openai/org_id',
      'openai_project': 'meta/openai/project_id',
      'google_api': 'meta/google/api_key',
      'cloudflare_api_token': 'meta/cloudflare/api_token',
      'cloudflare_api_key': 'meta/cloudflare/api_key',
      'github_pat': 'meta/github/pat',
      'github_oauth': 'meta/github/oauth_token',
      'github_app': 'meta/github/app_token',
      'github_refresh': 'meta/github/refresh_token',
      'aws_access_key': 'meta/aws/access_key',
      'aws_secret_key': 'meta/aws/secret_key',
    };

    if (metaTypes[type]) {
      return metaTypes[type];
    }

    // Project-level secrets
    if (project) {
      const projectTypes: Record<string, string> = {
        'stripe_live_secret': `project/${project}/stripe_secret_key`,
        'stripe_test_secret': `project/${project}/stripe_test_key`,
        'stripe_live_publishable': `project/${project}/stripe_publishable_key`,
        'stripe_test_publishable': `project/${project}/stripe_test_publishable_key`,
        'stripe_restricted': `project/${project}/stripe_restricted_key`,
        'postgres': `project/${project}/database_url`,
        'mongodb': `project/${project}/database_url`,
        'mysql': `project/${project}/database_url`,
        'redis': `project/${project}/redis_url`,
        'database_url': `project/${project}/database_url`,
        'jwt_token': `project/${project}/jwt_secret`,
        'api_key': `project/${project}/api_key`,
        'password': `project/${project}/password`,
      };

      if (projectTypes[type]) {
        return projectTypes[type];
      }

      // Service-level secrets
      if (service) {
        return `project/${project}/${service}/${type}`;
      }

      // Generic project secret
      return `project/${project}/${type}`;
    }

    // Fallback to meta
    return `meta/${type}`;
  }

  /**
   * Generate human-readable description
   */
  private generateDescription(type: string, context?: DetectionContext): string {
    const project = context?.projectName ? ` for ${context.projectName}` : '';
    const service = context?.serviceName ? ` (${context.serviceName})` : '';

    const descriptions: Record<string, string> = {
      // Anthropic
      'anthropic': 'Anthropic API key for Claude',

      // OpenAI
      'openai': 'OpenAI API key',
      'openai_org': 'OpenAI organization ID',
      'openai_project': 'OpenAI project ID',

      // Google
      'google_api': 'Google/Gemini API key',

      // Stripe
      'stripe_live_secret': `Stripe live secret key${project}${service}`,
      'stripe_test_secret': `Stripe test secret key${project}${service}`,
      'stripe_live_publishable': `Stripe live publishable key${project}${service}`,
      'stripe_test_publishable': `Stripe test publishable key${project}${service}`,
      'stripe_restricted': `Stripe restricted API key${project}${service}`,

      // GitHub
      'github_pat': 'GitHub personal access token',
      'github_oauth': 'GitHub OAuth token',
      'github_app': 'GitHub App token',
      'github_refresh': 'GitHub refresh token',

      // Cloudflare
      'cloudflare_api_token': 'Cloudflare API token',
      'cloudflare_api_key': 'Cloudflare API key',

      // AWS
      'aws_access_key': 'AWS access key ID',
      'aws_secret_key': 'AWS secret access key',

      // Databases
      'postgres': `PostgreSQL connection string${project}${service}`,
      'mongodb': `MongoDB connection string${project}${service}`,
      'mysql': `MySQL connection string${project}${service}`,
      'redis': `Redis connection string${project}${service}`,
      'database_url': `Database URL${project}${service}`,

      // Generic
      'jwt_token': `JWT token${project}${service}`,
      'bearer_token': `Bearer token${project}${service}`,
      'api_key': `API key${project}${service}`,
      'password': `Password${project}${service}`,
    };

    return descriptions[type] || `Secret${project}${service}`;
  }

  /**
   * Redact secret from string (for logging)
   *
   * @param text - Text potentially containing secrets
   * @returns Text with secrets redacted
   */
  redactSecrets(text: string): string {
    let redacted = text;

    // Redact against all patterns
    for (const [type, pattern] of Object.entries(this.patterns)) {
      redacted = redacted.replace(pattern, (match) => {
        // Show first 4 and last 4 characters
        if (match.length <= 12) {
          return '[REDACTED]';
        }
        const prefix = match.substring(0, 4);
        const suffix = match.substring(match.length - 4);
        return `${prefix}...${suffix}`;
      });
    }

    return redacted;
  }

  /**
   * Check if a string contains any secrets
   *
   * @param text - Text to check
   * @returns true if secrets detected
   */
  containsSecrets(text: string): boolean {
    for (const pattern of Object.values(this.patterns)) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Extract all secrets from text
   *
   * @param text - Text to extract from
   * @param context - Optional context
   * @returns Array of detected secrets
   */
  extractAllSecrets(text: string, context?: DetectionContext): SecretDetection[] {
    const secrets: SecretDetection[] = [];
    const words = text.split(/\s+/);

    for (const word of words) {
      const detection = this.detectSecret(word, context);
      if (detection && !secrets.some(s => s.value === detection.value)) {
        secrets.push(detection);
      }
    }

    return secrets;
  }
}
