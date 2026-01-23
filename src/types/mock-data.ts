/**
 * Mock Data Generation Types
 * Epic: UI-005 - Mock Data Generation System
 */

/**
 * Entity definition for mock data generation
 */
export interface EntityDefinition {
  name: string;
  fields: Record<string, string>; // field name -> faker path
  count?: number;
}

/**
 * Relationship between entities
 */
export interface EntityRelationship {
  from: string; // entity name
  to: string; // entity name
  field: string; // field name in 'from' entity
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
}

/**
 * Mock data specification
 */
export interface MockDataSpec {
  entities: EntityDefinition[];
  generator: 'faker' | 'hardcoded' | 'custom';
  relationships?: EntityRelationship[];
}

/**
 * Generated data object
 */
export interface GeneratedData {
  [entityName: string]: any[];
}

/**
 * Domain template types
 */
export type DomainTemplate = 'users' | 'products' | 'orders' | 'transactions';

/**
 * Parameters for generating mock data
 */
export interface MockDataGenerateParams {
  epicId: string;
  count?: number; // Default count if not specified in requirements
  template?: DomainTemplate; // Use predefined template
  relationships?: EntityRelationship[]; // Define relationships
  seed?: number; // Faker seed for reproducible data
}

/**
 * Result of mock data generation
 */
export interface MockDataGenerateResult {
  success: boolean;
  data?: GeneratedData;
  spec?: MockDataSpec;
  sample?: GeneratedData; // First 3 items of each entity
  error?: string;
}

/**
 * Stored mock data in database
 */
export interface StoredMockData {
  epic_id: string;
  mock_data_spec: MockDataSpec;
  mock_data_sample: GeneratedData;
  created_at: Date;
  updated_at: Date;
}
