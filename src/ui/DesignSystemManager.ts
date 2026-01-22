/**
 * Design System Manager
 * Handles CRUD operations for design systems
 * Epic: UI-002 - Design System Foundation
 */

import { pool } from '../db/client.js';
import type {
  DesignSystem,
  CreateDesignSystemParams,
  UpdateDesignSystemParams,
  GetDesignSystemParams,
  DeleteDesignSystemParams,
  CreateDesignSystemResult,
  StyleConfig,
  ComponentLibrary,
} from '../types/design-system.js';

/**
 * Manager class for design system operations
 */
export class DesignSystemManager {
  /**
   * Create a new design system
   *
   * @param params - Design system creation parameters
   * @returns Result with created design system or error
   */
  async createDesignSystem(params: CreateDesignSystemParams): Promise<CreateDesignSystemResult> {
    try {
      // Validate required fields
      if (!params.projectName || !params.name) {
        return {
          success: false,
          error: 'projectName and name are required',
        };
      }

      // Validate style config structure
      const validationError = this.validateStyleConfig(params.styleConfig);
      if (validationError) {
        return {
          success: false,
          error: validationError,
        };
      }

      // Default component library if not provided
      const componentLibrary: ComponentLibrary = params.componentLibrary || {
        components: [],
        version: '1.0.0',
      };

      // Insert into database
      const query = `
        INSERT INTO design_systems (
          project_name,
          name,
          description,
          style_config,
          component_library
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [
        params.projectName,
        params.name,
        params.description || null,
        JSON.stringify(params.styleConfig),
        JSON.stringify(componentLibrary),
      ];

      const result = await pool.query(query, values);
      const designSystem = this.mapRowToDesignSystem(result.rows[0]);

      return {
        success: true,
        designSystem,
      };
    } catch (error) {
      // Handle unique constraint violation
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        return {
          success: false,
          error: `Design system '${params.name}' already exists for project '${params.projectName}'`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating design system',
      };
    }
  }

  /**
   * Get design system by ID
   *
   * @param id - Design system ID
   * @returns Design system or null
   */
  async getDesignSystemById(id: number): Promise<DesignSystem | null> {
    try {
      const query = `
        SELECT * FROM design_systems
        WHERE id = $1
      `;
      const result = await pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToDesignSystem(result.rows[0]);
    } catch (error) {
      console.error('Error getting design system by ID:', error);
      throw error;
    }
  }

  /**
   * Get design system(s) for a project
   *
   * @param params - Query parameters
   * @returns Design system(s) or null
   */
  async getDesignSystem(params: GetDesignSystemParams): Promise<DesignSystem | DesignSystem[] | null> {
    try {
      if (params.name) {
        // Get specific design system
        const query = `
          SELECT * FROM design_systems
          WHERE project_name = $1 AND name = $2
        `;
        const result = await pool.query(query, [params.projectName, params.name]);

        if (result.rows.length === 0) {
          return null;
        }

        return this.mapRowToDesignSystem(result.rows[0]);
      } else {
        // Get all design systems for project
        const query = `
          SELECT * FROM design_systems
          WHERE project_name = $1
          ORDER BY created_at DESC
        `;
        const result = await pool.query(query, [params.projectName]);

        if (result.rows.length === 0) {
          return null;
        }

        return result.rows.map(row => this.mapRowToDesignSystem(row));
      }
    } catch (error) {
      console.error('Error getting design system:', error);
      throw error;
    }
  }

  /**
   * Update an existing design system
   *
   * @param params - Update parameters
   * @returns Updated design system or null
   */
  async updateDesignSystem(params: UpdateDesignSystemParams): Promise<DesignSystem | null> {
    try {
      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let valueIndex = 1;

      if (params.name !== undefined) {
        updates.push(`name = $${valueIndex++}`);
        values.push(params.name);
      }

      if (params.description !== undefined) {
        updates.push(`description = $${valueIndex++}`);
        values.push(params.description);
      }

      if (params.styleConfig !== undefined) {
        // Validate style config
        const validationError = this.validateStyleConfig(params.styleConfig);
        if (validationError) {
          throw new Error(validationError);
        }

        updates.push(`style_config = $${valueIndex++}`);
        values.push(JSON.stringify(params.styleConfig));
      }

      if (params.componentLibrary !== undefined) {
        updates.push(`component_library = $${valueIndex++}`);
        values.push(JSON.stringify(params.componentLibrary));
      }

      if (updates.length === 0) {
        throw new Error('No fields to update');
      }

      // Add ID to values
      values.push(params.id);

      const query = `
        UPDATE design_systems
        SET ${updates.join(', ')}
        WHERE id = $${valueIndex}
        RETURNING *
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToDesignSystem(result.rows[0]);
    } catch (error) {
      console.error('Error updating design system:', error);
      throw error;
    }
  }

  /**
   * Delete a design system
   *
   * @param params - Delete parameters
   * @returns True if deleted, false if not found
   */
  async deleteDesignSystem(params: DeleteDesignSystemParams): Promise<boolean> {
    try {
      const query = `
        DELETE FROM design_systems
        WHERE id = $1
        RETURNING id
      `;

      const result = await pool.query(query, [params.id]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting design system:', error);
      throw error;
    }
  }

  /**
   * Update Storybook deployment info for a design system
   *
   * @param id - Design system ID
   * @param port - Storybook port
   * @param url - Storybook URL
   * @returns Updated design system
   */
  async updateStorybookInfo(id: number, port: number, url: string): Promise<DesignSystem | null> {
    try {
      const query = `
        UPDATE design_systems
        SET storybook_port = $1, storybook_url = $2
        WHERE id = $3
        RETURNING *
      `;

      const result = await pool.query(query, [port, url, id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToDesignSystem(result.rows[0]);
    } catch (error) {
      console.error('Error updating Storybook info:', error);
      throw error;
    }
  }

  /**
   * Validate style config structure
   *
   * @param styleConfig - Style configuration to validate
   * @returns Error message or null if valid
   */
  private validateStyleConfig(styleConfig: StyleConfig): string | null {
    if (!styleConfig) {
      return 'styleConfig is required';
    }

    // Check required sections
    if (!styleConfig.colors) {
      return 'styleConfig.colors is required';
    }

    if (!styleConfig.typography) {
      return 'styleConfig.typography is required';
    }

    if (!styleConfig.spacing) {
      return 'styleConfig.spacing is required';
    }

    // Validate colors
    const { colors } = styleConfig;
    if (!colors.primary || !colors.secondary || !colors.background || !colors.surface) {
      return 'styleConfig.colors must include primary, secondary, background, and surface';
    }

    if (!colors.text || !colors.text.primary || !colors.text.secondary) {
      return 'styleConfig.colors.text must include primary and secondary';
    }

    // Validate typography
    const { typography } = styleConfig;
    if (!typography.fontFamily || !typography.fontSize || !typography.fontWeight || !typography.lineHeight) {
      return 'styleConfig.typography must include fontFamily, fontSize, fontWeight, and lineHeight';
    }

    // Validate spacing
    const { spacing } = styleConfig;
    if (!spacing.xs || !spacing.sm || !spacing.md || !spacing.lg || !spacing.xl) {
      return 'styleConfig.spacing must include xs, sm, md, lg, xl';
    }

    return null;
  }

  /**
   * Map database row to DesignSystem type
   *
   * @param row - Database row
   * @returns DesignSystem object
   */
  private mapRowToDesignSystem(row: any): DesignSystem {
    return {
      id: row.id,
      project_name: row.project_name,
      name: row.name,
      description: row.description,
      style_config: row.style_config,
      component_library: row.component_library,
      storybook_port: row.storybook_port,
      storybook_url: row.storybook_url,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
