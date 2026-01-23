/**
 * Figma Design Importer
 * Epic: UI-004 - Figma Design Import Integration
 *
 * Imports Figma designs by:
 * 1. Parsing Figma URLs to extract fileKey and nodeId
 * 2. Calling Figma MCP tools to get design context and tokens
 * 3. Taking screenshots for preview
 * 4. Storing in ui_mockups table
 */

import { pool } from '../db/client.js';
import type {
  ImportFigmaDesignParams,
  ImportFigmaDesignResult,
  ParsedFigmaUrl,
  FigmaUrlValidation,
  FigmaDesignContext,
  FigmaDesignTokens,
  FigmaScreenshot,
  UIMockup,
  FIGMA_URL_PATTERNS,
} from '../types/ui-004.js';

/**
 * FigmaDesignImporter imports Figma designs as UI mockups
 */
export class FigmaDesignImporter {
  /**
   * Parse Figma URL to extract fileKey and nodeId
   */
  public parseFigmaUrl(url: string): FigmaUrlValidation {
    // Try design URL pattern
    const designMatch = url.match(
      /^https:\/\/(?:www\.)?figma\.com\/design\/([^/]+)\/([^?]+)\?.*node-id=([^&]+)/
    );

    if (designMatch) {
      return {
        valid: true,
        parsed: {
          fileKey: designMatch[1],
          nodeId: designMatch[3].replace(/-/g, ':'),
          originalUrl: url,
        },
      };
    }

    // Try file URL pattern
    const fileMatch = url.match(
      /^https:\/\/(?:www\.)?figma\.com\/file\/([^/]+)\/([^?]+)\?.*node-id=([^&]+)/
    );

    if (fileMatch) {
      return {
        valid: true,
        parsed: {
          fileKey: fileMatch[1],
          nodeId: fileMatch[3].replace(/-/g, ':'),
          originalUrl: url,
        },
      };
    }

    // Try branch URL pattern
    const branchMatch = url.match(
      /^https:\/\/(?:www\.)?figma\.com\/design\/([^/]+)\/branch\/([^/]+)\/([^?]+)\?.*node-id=([^&]+)/
    );

    if (branchMatch) {
      return {
        valid: true,
        parsed: {
          fileKey: branchMatch[2], // Use branchKey as fileKey
          nodeId: branchMatch[4].replace(/-/g, ':'),
          branchKey: branchMatch[2],
          originalUrl: url,
        },
      };
    }

    return {
      valid: false,
      error: 'Invalid Figma URL. Expected format: https://figma.com/design/{fileKey}/{fileName}?node-id={nodeId}',
    };
  }

  /**
   * Import Figma design
   *
   * Steps:
   * 1. Parse Figma URL
   * 2. Call Figma MCP: get_design_context
   * 3. Call Figma MCP: get_variable_defs
   * 4. Call Figma MCP: get_screenshot
   * 5. Store in ui_mockups table
   */
  public async importDesign(params: ImportFigmaDesignParams): Promise<ImportFigmaDesignResult> {
    const warnings: string[] = [];

    try {
      // Step 1: Parse Figma URL
      const urlValidation = this.parseFigmaUrl(params.figmaUrl);

      if (!urlValidation.valid || !urlValidation.parsed) {
        return {
          success: false,
          error: urlValidation.error || 'Failed to parse Figma URL',
        };
      }

      const parsed = urlValidation.parsed;

      // Step 2: Get design context from Figma MCP
      const designContext = await this.getDesignContext(parsed);

      if (!designContext) {
        warnings.push('Failed to fetch design context from Figma');
      }

      // Step 3: Get design tokens from Figma MCP
      const designTokens = await this.getDesignTokens(parsed);

      if (!designTokens) {
        warnings.push('Failed to fetch design tokens from Figma');
      }

      // Step 4: Get screenshot from Figma MCP
      const screenshot = await this.getScreenshot(parsed);

      if (!screenshot) {
        warnings.push('Failed to generate screenshot from Figma');
      }

      // Step 5: Store in ui_mockups table
      const mockup = await this.storeMockup({
        epicId: params.epicId,
        projectName: params.projectName || 'unknown',
        figmaUrl: params.figmaUrl,
        figmaFileKey: parsed.fileKey,
        figmaNodeId: parsed.nodeId,
        designContext,
        designTokens,
        screenshot,
      });

      return {
        success: true,
        mockup,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error importing Figma design',
      };
    }
  }

  /**
   * Get design context from Figma MCP
   * NOTE: This is a placeholder - actual implementation would use Figma MCP tool
   */
  private async getDesignContext(parsed: ParsedFigmaUrl): Promise<FigmaDesignContext | null> {
    try {
      // In real implementation, this would call Figma MCP tool:
      // const result = await figmaMCP.get_design_context({
      //   fileKey: parsed.fileKey,
      //   nodeId: parsed.nodeId,
      // });

      // For now, return a placeholder structure
      return {
        metadata: {
          fileName: 'Figma Design',
          nodeName: 'Root Node',
          nodeType: 'FRAME',
        },
        componentHierarchy: [],
      };
    } catch (error) {
      console.error('Failed to get design context:', error);
      return null;
    }
  }

  /**
   * Get design tokens from Figma MCP
   * NOTE: This is a placeholder - actual implementation would use Figma MCP tool
   */
  private async getDesignTokens(parsed: ParsedFigmaUrl): Promise<FigmaDesignTokens | null> {
    try {
      // In real implementation, this would call Figma MCP tool:
      // const result = await figmaMCP.get_variable_defs({
      //   fileKey: parsed.fileKey,
      //   nodeId: parsed.nodeId,
      // });

      // For now, return a placeholder structure
      return {
        colors: {},
        typography: {},
        spacing: {},
        raw: {},
      };
    } catch (error) {
      console.error('Failed to get design tokens:', error);
      return null;
    }
  }

  /**
   * Get screenshot from Figma MCP
   * NOTE: This is a placeholder - actual implementation would use Figma MCP tool
   */
  private async getScreenshot(parsed: ParsedFigmaUrl): Promise<FigmaScreenshot | null> {
    try {
      // In real implementation, this would call Figma MCP tool:
      // const result = await figmaMCP.get_screenshot({
      //   fileKey: parsed.fileKey,
      //   nodeId: parsed.nodeId,
      //   format: 'png',
      // });

      // For now, return a placeholder structure
      return {
        data: '', // Base64 encoded PNG
        format: 'png',
      };
    } catch (error) {
      console.error('Failed to get screenshot:', error);
      return null;
    }
  }

  /**
   * Store mockup in ui_mockups table
   */
  private async storeMockup(data: {
    epicId: string;
    projectName: string;
    figmaUrl: string;
    figmaFileKey: string;
    figmaNodeId: string;
    designContext: FigmaDesignContext | null;
    designTokens: FigmaDesignTokens | null;
    screenshot: FigmaScreenshot | null;
  }): Promise<UIMockup> {
    const query = `
      INSERT INTO ui_mockups (
        epic_id,
        project_name,
        design_method,
        design_url,
        figma_url,
        figma_file_key,
        figma_node_id,
        figma_design_context,
        figma_design_tokens,
        figma_screenshot_data,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (epic_id)
      DO UPDATE SET
        design_method = EXCLUDED.design_method,
        design_url = EXCLUDED.design_url,
        figma_url = EXCLUDED.figma_url,
        figma_file_key = EXCLUDED.figma_file_key,
        figma_node_id = EXCLUDED.figma_node_id,
        figma_design_context = EXCLUDED.figma_design_context,
        figma_design_tokens = EXCLUDED.figma_design_tokens,
        figma_screenshot_data = EXCLUDED.figma_screenshot_data,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      data.epicId,
      data.projectName,
      'figma',
      data.figmaUrl,
      data.figmaUrl,
      data.figmaFileKey,
      data.figmaNodeId,
      JSON.stringify(data.designContext),
      JSON.stringify(data.designTokens),
      data.screenshot?.data || null,
      'draft',
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Get mockup by epic ID
   */
  public async getMockupByEpicId(epicId: string): Promise<UIMockup | null> {
    const query = `
      SELECT * FROM ui_mockups
      WHERE epic_id = $1
    `;

    const result = await pool.query(query, [epicId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Update mockup status
   */
  public async updateMockupStatus(
    epicId: string,
    status: 'draft' | 'approved' | 'connected' | 'archived'
  ): Promise<UIMockup | null> {
    const query = `
      UPDATE ui_mockups
      SET status = $1, updated_at = NOW()
      WHERE epic_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [status, epicId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}
