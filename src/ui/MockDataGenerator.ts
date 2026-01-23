/**
 * Mock Data Generator
 * Generates realistic fake data for UI mockups using Faker.js
 * Epic: UI-005 - Mock Data Generation System
 */

import { faker } from '@faker-js/faker';
import { pool } from '../db/client.js';
import type {
  MockDataSpec,
  MockDataGenerateParams,
  MockDataGenerateResult,
  DomainTemplate,
  GeneratedData,
  EntityDefinition,
} from '../types/mock-data.js';

/**
 * Manager class for mock data generation
 */
export class MockDataGenerator {
  /**
   * Generate mock data for a UI mockup
   *
   * @param params - Generation parameters
   * @returns Result with generated data or error
   */
  async generateMockData(params: MockDataGenerateParams): Promise<MockDataGenerateResult> {
    try {
      // Validate required fields
      if (!params.epicId) {
        return {
          success: false,
          error: 'epicId is required',
        };
      }

      // Get UI requirements for this epic
      const requirements = await this.getUIRequirements(params.epicId);
      if (!requirements) {
        return {
          success: false,
          error: `No UI requirements found for epic ${params.epicId}`,
        };
      }

      // Parse data requirements
      const spec = this.createMockDataSpec(requirements.data_requirements, params);

      // Generate data based on spec
      const data = this.generateFromSpec(spec, params.count || 10);

      // Generate sample data (first 3 items)
      const sample = this.generateSample(data);

      // Store spec and sample in database
      await this.saveMockDataSpec(params.epicId, spec, sample);

      return {
        success: true,
        data,
        spec,
        sample,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating mock data',
      };
    }
  }

  /**
   * Get UI requirements from database
   */
  private async getUIRequirements(epicId: string): Promise<any> {
    const query = `
      SELECT * FROM ui_requirements
      WHERE epic_id = $1
    `;

    const result = await pool.query(query, [epicId]);
    return result.rows[0] || null;
  }

  /**
   * Create mock data specification from requirements
   */
  private createMockDataSpec(
    dataRequirements: string[],
    params: MockDataGenerateParams
  ): MockDataSpec {
    const entities: EntityDefinition[] = [];

    // Parse each data requirement
    for (const requirement of dataRequirements) {
      const entity = this.parseRequirement(requirement);
      if (entity) {
        entities.push(entity);
      }
    }

    // Apply template if specified
    if (params.template) {
      const templateEntities = this.getTemplateEntities(params.template);
      entities.push(...templateEntities);
    }

    return {
      entities,
      generator: 'faker',
      relationships: params.relationships || [],
    };
  }

  /**
   * Parse a single data requirement into entity definition
   */
  private parseRequirement(requirement: string): EntityDefinition | null {
    // Examples:
    // "List of 20 users (name, email, avatar, role)"
    // "Products (id, name, price, description, image)"
    // "Orders with user relationship"

    const match = requirement.match(/(\w+)\s*\((.*?)\)/i);
    if (!match) return null;

    const [, entityName, fieldsList] = match;
    const fields = fieldsList.split(',').map((f) => f.trim());

    return {
      name: entityName.toLowerCase(),
      fields: this.mapFieldsToFaker(fields),
      count: this.extractCount(requirement),
    };
  }

  /**
   * Map field names to Faker.js generators
   */
  private mapFieldsToFaker(fields: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};

    for (const field of fields) {
      const fieldLower = field.toLowerCase();

      if (fieldLower.includes('name')) {
        mapping[field] = 'person.fullName';
      } else if (fieldLower.includes('email')) {
        mapping[field] = 'internet.email';
      } else if (fieldLower.includes('avatar') || fieldLower.includes('image')) {
        mapping[field] = 'image.avatar';
      } else if (fieldLower.includes('role')) {
        mapping[field] = 'person.jobTitle';
      } else if (fieldLower.includes('price') || fieldLower.includes('amount')) {
        mapping[field] = 'commerce.price';
      } else if (fieldLower.includes('description')) {
        mapping[field] = 'lorem.sentence';
      } else if (fieldLower.includes('date')) {
        mapping[field] = 'date.recent';
      } else if (fieldLower.includes('phone')) {
        mapping[field] = 'phone.number';
      } else if (fieldLower.includes('address')) {
        mapping[field] = 'location.streetAddress';
      } else if (fieldLower.includes('city')) {
        mapping[field] = 'location.city';
      } else if (fieldLower.includes('country')) {
        mapping[field] = 'location.country';
      } else if (fieldLower.includes('company')) {
        mapping[field] = 'company.name';
      } else if (fieldLower === 'id') {
        mapping[field] = 'string.uuid';
      } else {
        // Default to lorem text
        mapping[field] = 'lorem.word';
      }
    }

    return mapping;
  }

  /**
   * Extract count from requirement text
   */
  private extractCount(requirement: string): number {
    const match = requirement.match(/(\d+)\s+(users|items|products|orders)/i);
    return match ? parseInt(match[1], 10) : 10;
  }

  /**
   * Get template entity definitions
   */
  private getTemplateEntities(template: string): EntityDefinition[] {
    const templates: Record<string, EntityDefinition[]> = {
      users: [
        {
          name: 'users',
          fields: {
            id: 'string.uuid',
            name: 'person.fullName',
            email: 'internet.email',
            avatar: 'image.avatar',
            role: 'person.jobTitle',
            createdAt: 'date.past',
          },
          count: 20,
        },
      ],
      products: [
        {
          name: 'products',
          fields: {
            id: 'string.uuid',
            name: 'commerce.productName',
            price: 'commerce.price',
            description: 'commerce.productDescription',
            image: 'image.urlLoremFlickr',
            category: 'commerce.department',
            stock: 'number.int',
          },
          count: 50,
        },
      ],
      orders: [
        {
          name: 'orders',
          fields: {
            id: 'string.uuid',
            orderNumber: 'string.alphanumeric',
            userId: 'string.uuid',
            total: 'commerce.price',
            status: 'helpers.arrayElement',
            createdAt: 'date.recent',
          },
          count: 100,
        },
      ],
      transactions: [
        {
          name: 'transactions',
          fields: {
            id: 'string.uuid',
            amount: 'finance.amount',
            currency: 'finance.currencyCode',
            description: 'finance.transactionDescription',
            date: 'date.recent',
            type: 'helpers.arrayElement',
          },
          count: 200,
        },
      ],
    };

    return templates[template] || [];
  }

  /**
   * Generate data from specification
   */
  private generateFromSpec(spec: MockDataSpec, defaultCount: number): GeneratedData {
    const data: GeneratedData = {};

    for (const entity of spec.entities) {
      const count = entity.count || defaultCount;
      data[entity.name] = this.generateEntity(entity, count);
    }

    return data;
  }

  /**
   * Generate array of entities
   */
  private generateEntity(entity: EntityDefinition, count: number): any[] {
    const items: any[] = [];

    for (let i = 0; i < count; i++) {
      const item: any = {};

      for (const [field, fakerPath] of Object.entries(entity.fields)) {
        item[field] = this.generateField(fakerPath);
      }

      items.push(item);
    }

    return items;
  }

  /**
   * Generate a single field value using Faker.js
   */
  private generateField(fakerPath: string): any {
    try {
      // Handle special cases
      if (fakerPath === 'helpers.arrayElement') {
        return faker.helpers.arrayElement(['pending', 'completed', 'cancelled']);
      }

      if (fakerPath === 'number.int') {
        return faker.number.int({ min: 0, max: 1000 });
      }

      // Parse faker path (e.g., "person.fullName" -> faker.person.fullName())
      const parts = fakerPath.split('.');
      let current: any = faker;

      for (const part of parts) {
        current = current[part];
      }

      // Call function if it's a function
      return typeof current === 'function' ? current() : current;
    } catch (error) {
      // Fallback to lorem word
      return faker.lorem.word();
    }
  }

  /**
   * Generate sample data (first 3 items of each entity)
   */
  private generateSample(data: GeneratedData): GeneratedData {
    const sample: GeneratedData = {};

    for (const [entityName, items] of Object.entries(data)) {
      sample[entityName] = items.slice(0, 3);
    }

    return sample;
  }

  /**
   * Save mock data spec to database
   */
  private async saveMockDataSpec(
    epicId: string,
    spec: MockDataSpec,
    sample: GeneratedData
  ): Promise<void> {
    const query = `
      UPDATE ui_mockups
      SET
        mock_data_spec = $1,
        mock_data_sample = $2
      WHERE epic_id = $3
    `;

    await pool.query(query, [JSON.stringify(spec), JSON.stringify(sample), epicId]);
  }

  /**
   * Get stored mock data spec from database
   */
  async getMockDataSpec(epicId: string): Promise<MockDataSpec | null> {
    const query = `
      SELECT mock_data_spec FROM ui_mockups
      WHERE epic_id = $1
    `;

    const result = await pool.query(query, [epicId]);
    const row = result.rows[0];

    return row?.mock_data_spec || null;
  }

  /**
   * Get stored mock data sample from database
   */
  async getMockDataSample(epicId: string): Promise<GeneratedData | null> {
    const query = `
      SELECT mock_data_sample FROM ui_mockups
      WHERE epic_id = $1
    `;

    const result = await pool.query(query, [epicId]);
    const row = result.rows[0];

    return row?.mock_data_sample || null;
  }
}

/**
 * Convenience function to generate mock data
 */
export async function generateMockData(
  params: MockDataGenerateParams
): Promise<MockDataGenerateResult> {
  const generator = new MockDataGenerator();
  return generator.generateMockData(params);
}
