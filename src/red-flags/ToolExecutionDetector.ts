/**
 * Tool Execution Detector
 * Epic 006-B: Verify MCP tools were actually called as claimed
 *
 * CRITICAL severity: Tool not executed as claimed
 */

import { Pool } from 'pg';
import { CreateRedFlagInput, TestType, RedFlagProof } from '../types/red-flags.js';
import { EvidenceArtifact, TestResult } from './MissingEvidenceDetector.js';

/**
 * MCP tool call record
 */
export interface McpToolCall {
  tool: string;
  parameters: Record<string, any>;
  result: any;
  timestamp: Date;
}

/**
 * Detect when expected MCP tools were not called
 */
export class ToolExecutionDetector {
  constructor(private pool: Pool) {}

  /**
   * Detect tool execution issues for a test
   */
  async detect(
    epicId: string,
    test: TestResult,
    evidence: EvidenceArtifact[]
  ): Promise<CreateRedFlagInput[]> {
    const flags: CreateRedFlagInput[] = [];

    // Only check tests that passed
    if (test.passFail !== 'pass') {
      return flags;
    }

    // Parse test plan/description to extract expected tools
    const expectedTools = this.extractExpectedTools(test.name);
    if (expectedTools.length === 0) {
      return flags; // No tool expectations
    }

    // Get actual tool calls from evidence
    const mcpToolCallEvidence = evidence.find((e) => e.artifactType === 'mcp_tool_call');
    const actualTools = mcpToolCallEvidence
      ? this.extractActualTools(mcpToolCallEvidence)
      : [];

    // Check for missing tools
    const missingTools = expectedTools.filter((expected) => !actualTools.includes(expected));
    if (missingTools.length > 0) {
      flags.push(
        this.createMissingToolsFlag(
          epicId,
          test,
          expectedTools,
          actualTools,
          missingTools,
          mcpToolCallEvidence?.id
        )
      );
    }

    // Check for wrong tools called
    const wrongTools = actualTools.filter((actual) => !expectedTools.includes(actual));
    if (wrongTools.length > 0 && missingTools.length > 0) {
      // Only flag if wrong tools AND missing expected tools
      flags.push(
        this.createWrongToolsFlag(
          epicId,
          test,
          expectedTools,
          actualTools,
          wrongTools,
          mcpToolCallEvidence?.id
        )
      );
    }

    // Check for tool execution without evidence
    const toolResultEvidence = evidence.find((e) => e.artifactType === 'tool_result');
    if (!toolResultEvidence && actualTools.length > 0) {
      flags.push(
        this.createNoToolResultFlag(epicId, test, actualTools, mcpToolCallEvidence?.id)
      );
    }

    return flags;
  }

  /**
   * Extract expected tool calls from test description
   *
   * Looks for patterns like:
   * - "test mcp__figma__get_screenshot"
   * - "verify mcp__playwright__browser_snapshot is called"
   * - "should call mcp__playwright__browser_click"
   */
  private extractExpectedTools(testDescription: string): string[] {
    const tools: string[] = [];

    // Pattern: mcp__<server>__<tool>
    const mcpPattern = /mcp__[a-z0-9_]+__[a-z0-9_]+/gi;
    const matches = testDescription.match(mcpPattern);

    if (matches) {
      tools.push(...matches.map((m) => m.toLowerCase()));
    }

    return [...new Set(tools)]; // Deduplicate
  }

  /**
   * Extract actual tool calls from evidence
   */
  private extractActualTools(mcpToolCallEvidence: EvidenceArtifact): string[] {
    const metadata = mcpToolCallEvidence.metadata || {};

    // Check if metadata contains tool calls array
    if (Array.isArray(metadata.toolCalls)) {
      return metadata.toolCalls.map((call: McpToolCall) => call.tool.toLowerCase());
    }

    // Check if metadata contains single tool call
    if (metadata.tool) {
      return [metadata.tool.toLowerCase()];
    }

    // Check if metadata contains tool name
    if (metadata.toolName) {
      return [metadata.toolName.toLowerCase()];
    }

    return [];
  }

  /**
   * Create flag for missing tools
   */
  private createMissingToolsFlag(
    epicId: string,
    test: TestResult,
    expectedTools: string[],
    actualTools: string[],
    missingTools: string[],
    evidenceId?: number
  ): CreateRedFlagInput {
    const proof: RedFlagProof = {
      testId: test.id,
      testType: test.type,
      expectedTools,
      actualTools,
      missingTools,
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId,
      flagType: 'tool_execution',
      severity: 'critical',
      description: `Test "${test.name}" passed but expected MCP tools not called: ${missingTools.join(', ')}`,
      proof,
    };
  }

  /**
   * Create flag for wrong tools called
   */
  private createWrongToolsFlag(
    epicId: string,
    test: TestResult,
    expectedTools: string[],
    actualTools: string[],
    wrongTools: string[],
    evidenceId?: number
  ): CreateRedFlagInput {
    // Try to match wrong tools to expected tools
    const possibleMatches = wrongTools.map((wrong) => {
      const match = expectedTools.find((expected) => {
        // Check if tools are from same server
        const wrongParts = wrong.split('__');
        const expectedParts = expected.split('__');
        return wrongParts[1] === expectedParts[1]; // Same server
      });
      return { actual: wrong, expected: match || 'none' };
    });

    const proof: RedFlagProof = {
      testId: test.id,
      testType: test.type,
      expectedTools,
      actualTools,
      wrongToolCalled: possibleMatches[0] || { actual: wrongTools[0], expected: expectedTools[0] },
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId,
      flagType: 'tool_execution',
      severity: 'critical',
      description: `Test "${test.name}" called wrong tools: ${wrongTools.join(', ')} instead of ${expectedTools.join(', ')}`,
      proof,
    };
  }

  /**
   * Create flag for tool execution without result evidence
   */
  private createNoToolResultFlag(
    epicId: string,
    test: TestResult,
    actualTools: string[],
    evidenceId?: number
  ): CreateRedFlagInput {
    const proof: RedFlagProof = {
      testId: test.id,
      testType: test.type,
      actualTools,
      missingArtifacts: ['tool_result'],
      timestamp: test.executedAt.toISOString(),
    };

    return {
      epicId,
      testId: test.id,
      evidenceId,
      flagType: 'tool_execution',
      severity: 'critical',
      description: `Test "${test.name}" called tools but no tool result evidence collected`,
      proof,
    };
  }
}
