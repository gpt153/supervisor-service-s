/**
 * IngressManager - Cloudflared config.yml management
 *
 * Responsibilities:
 * - Read and parse /etc/cloudflared/config.yml
 * - Add/remove ingress rules
 * - Maintain catch-all 404 rule at end
 * - Atomic writes (temp file → rename)
 * - Git backup after changes
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { load, dump } from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { IngressConfig, IngressRule } from './types.js';

const execAsync = promisify(exec);

export class IngressManager {
  private configPath: string;

  constructor(configPath: string = '/etc/cloudflared/config.yml') {
    this.configPath = configPath;
  }

  /**
   * Read and parse config file
   */
  readConfig(): IngressConfig {
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const config = load(content) as IngressConfig;
      this.validateConfig(config);
      return config;
    } catch (error) {
      console.error('Failed to read config:', error);
      throw new Error(`Failed to read config file: ${error}`);
    }
  }

  /**
   * Validate config structure
   */
  private validateConfig(config: any): void {
    if (!config.tunnel) {
      throw new Error('Config missing tunnel ID');
    }
    if (!config['credentials-file']) {
      throw new Error('Config missing credentials-file');
    }
    if (!config.ingress || !Array.isArray(config.ingress)) {
      throw new Error('Config missing ingress array');
    }
    if (config.ingress.length === 0) {
      throw new Error('Config ingress array is empty');
    }

    // Check that last rule is catch-all
    const lastRule = config.ingress[config.ingress.length - 1];
    if (lastRule.hostname) {
      throw new Error('Last ingress rule must be catch-all (no hostname)');
    }
  }

  /**
   * Add ingress rule (before catch-all)
   */
  addIngressRule(hostname: string, service: string): void {
    const config = this.readConfig();

    // Check if hostname already exists
    const existing = config.ingress.find(rule => rule.hostname === hostname);
    if (existing) {
      throw new Error(`Ingress rule for ${hostname} already exists`);
    }

    // Create new rule
    const newRule: IngressRule = {
      hostname,
      service,
      originRequest: {
        noTLSVerify: true // For local services
      }
    };

    // Insert before catch-all (last rule)
    config.ingress.splice(config.ingress.length - 1, 0, newRule);

    // Write config
    this.writeConfig(config);
    this.backupConfig();
  }

  /**
   * Remove ingress rule
   */
  removeIngressRule(hostname: string): boolean {
    const config = this.readConfig();

    // Find and remove rule
    const index = config.ingress.findIndex(rule => rule.hostname === hostname);
    if (index === -1) {
      return false; // Rule not found
    }

    config.ingress.splice(index, 1);

    // Write config
    this.writeConfig(config);
    this.backupConfig();

    return true;
  }

  /**
   * Write config atomically
   */
  private writeConfig(config: IngressConfig): void {
    try {
      // Validate before writing
      this.validateConfig(config);

      // Convert to YAML
      const yamlContent = dump(config, {
        indent: 2,
        lineWidth: -1 // Disable line wrapping
      });

      // Write to temp file
      const tempPath = `${this.configPath}.tmp`;
      writeFileSync(tempPath, yamlContent, 'utf-8');

      // Atomic rename
      renameSync(tempPath, this.configPath);

      console.log('Config file updated successfully');
    } catch (error) {
      console.error('Failed to write config:', error);
      throw new Error(`Failed to write config file: ${error}`);
    }
  }

  /**
   * Backup config to git
   */
  private async backupConfig(): Promise<void> {
    try {
      const configDir = this.configPath.substring(0, this.configPath.lastIndexOf('/'));

      // Check if git repo exists
      const { stdout } = await execAsync(`cd ${configDir} && git rev-parse --git-dir 2>/dev/null || echo "not-a-repo"`);

      if (stdout.trim() === 'not-a-repo') {
        // Initialize git repo if it doesn't exist
        await execAsync(`cd ${configDir} && git init`);
      }

      // Add and commit
      await execAsync(`cd ${configDir} && git add config.yml`);
      await execAsync(`cd ${configDir} && git commit -m "Update ingress rules - $(date +%Y-%m-%d_%H:%M:%S)" || true`);

      console.log('Config backed up to git');
    } catch (error) {
      console.error('Git backup failed (non-fatal):', error);
      // Non-fatal - continue even if git backup fails
    }
  }

  /**
   * Get all ingress rules
   */
  getIngressRules(): IngressRule[] {
    const config = this.readConfig();
    // Exclude catch-all (last rule)
    return config.ingress.slice(0, -1);
  }

  /**
   * Check if hostname has ingress rule
   */
  hasIngressRule(hostname: string): boolean {
    const config = this.readConfig();
    return config.ingress.some(rule => rule.hostname === hostname);
  }

  /**
   * Regenerate config from CNAME database (recovery/sync)
   */
  regenerateFromCNAMEs(cnames: Array<{ full_hostname: string; target_service: string }>): void {
    const config = this.readConfig();

    // Keep tunnel ID and credentials
    const tunnelId = config.tunnel;
    const credentialsFile = config['credentials-file'];

    // Rebuild ingress rules from CNAMEs
    const ingressRules: IngressRule[] = cnames.map(cname => ({
      hostname: cname.full_hostname,
      service: cname.target_service,
      originRequest: {
        noTLSVerify: true
      }
    }));

    // Add catch-all rule at end
    ingressRules.push({
      service: 'http_status:404'
    });

    // Create new config
    const newConfig: IngressConfig = {
      tunnel: tunnelId,
      'credentials-file': credentialsFile,
      ingress: ingressRules
    };

    // Write atomically
    this.writeConfig(newConfig);
    this.backupConfig();

    console.log(`✅ Config regenerated with ${cnames.length} CNAME(s)`);
  }

  /**
   * Reload tunnel (trigger config reload)
   */
  async reloadTunnel(location: 'host' | 'container' = 'host'): Promise<boolean> {
    try {
      if (location === 'host') {
        // Reload systemd service
        await execAsync('systemctl reload-or-restart cloudflared');
      } else {
        // Restart Docker container
        await execAsync('docker restart cloudflared');
      }
      console.log('Tunnel reloaded successfully');
      return true;
    } catch (error) {
      console.error('Tunnel reload failed:', error);
      return false;
    }
  }
}
