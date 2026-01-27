/**
 * Epic 006-G: Error Handler
 *
 * Handles cross-stage errors, retries, and escalation
 */

import fs from 'fs/promises';
import path from 'path';
import type {
  TestWorkflow,
  WorkflowError,
  EscalationRequest,
  TestWorkflowResult,
  TestReport
} from '../types/orchestration.js';
import { WorkflowStateMachine } from './WorkflowStateMachine.js';
import { UnifiedReporter } from './UnifiedReporter.js';

/**
 * Handles errors in workflow execution
 */
export class ErrorHandler {
  private stateMachine: WorkflowStateMachine;
  private reporter: UnifiedReporter;
  private maxRetries: number = 3;
  private handoffDir: string;

  constructor(
    stateMachine: WorkflowStateMachine,
    reporter: UnifiedReporter,
    handoffDir: string = '/home/samuel/sv/supervisor-service-s/docs/handoffs'
  ) {
    this.stateMachine = stateMachine;
    this.reporter = reporter;
    this.handoffDir = handoffDir;
  }

  /**
   * Handle workflow error
   */
  async handle(workflow: TestWorkflow, error: Error): Promise<TestWorkflowResult> {
    const workflowError: WorkflowError = {
      workflowId: workflow.id,
      stage: workflow.current_stage,
      error: error.message,
      retryable: this.isRetryable(error),
      retriesUsed: workflow.retry_count,
      timestamp: new Date()
    };

    // Check if we should retry
    if (workflowError.retryable && workflow.retry_count < this.maxRetries) {
      return await this.retry(workflow, workflowError);
    }

    // Exhausted retries or non-retryable - escalate
    return await this.escalate(workflow, error.message);
  }

  /**
   * Retry workflow stage
   */
  private async retry(
    workflow: TestWorkflow,
    error: WorkflowError
  ): Promise<TestWorkflowResult> {
    console.log(
      `Retrying workflow ${workflow.id} at stage ${workflow.current_stage} ` +
      `(attempt ${workflow.retry_count + 1}/${this.maxRetries})`
    );

    // Increment retry count
    await this.stateMachine.incrementRetry(workflow);

    // Return partial result indicating retry needed
    return {
      success: false,
      workflow,
      report: await this.reporter.generate(workflow),
      error: `Retry needed: ${error.error}`
    };
  }

  /**
   * Escalate workflow to user
   */
  async escalate(workflow: TestWorkflow, reason: string): Promise<TestWorkflowResult> {
    console.log(
      `Escalating workflow ${workflow.id} to user: ${reason}`
    );

    // Mark workflow as escalated
    await this.stateMachine.escalate(workflow);
    await this.stateMachine.fail(workflow, `Escalated: ${reason}`);

    // Create escalation request
    const escalationRequest: EscalationRequest = {
      workflowId: workflow.id,
      reason,
      context: {
        testId: workflow.test_id,
        epicId: workflow.epic_id,
        stage: workflow.current_stage,
        error: workflow.error_message || reason,
        retriesUsed: workflow.retry_count
      },
      createdAt: new Date()
    };

    // Generate handoff document
    const handoffPath = await this.generateHandoff(workflow, escalationRequest);
    escalationRequest.handoffPath = handoffPath;

    // Generate report
    const report = await this.reporter.generate(workflow);

    return {
      success: false,
      workflow,
      report,
      error: `Escalated to user: ${reason}. Handoff: ${handoffPath}`
    };
  }

  /**
   * Generate handoff document for escalation
   */
  private async generateHandoff(
    workflow: TestWorkflow,
    escalation: EscalationRequest
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${timestamp}-${workflow.test_id}-escalation.md`;
    const filepath = path.join(this.handoffDir, filename);

    const handoff = `# Test Workflow Escalation

**Test ID**: ${workflow.test_id}
**Epic ID**: ${workflow.epic_id}
**Test Type**: ${workflow.test_type}
**Workflow ID**: ${workflow.id}

---

## Status

**Current Stage**: ${workflow.current_stage}
**Status**: ${workflow.status}
**Retries Used**: ${workflow.retry_count}
**Escalated At**: ${escalation.createdAt.toISOString()}

---

## Reason for Escalation

${escalation.reason}

---

## Error Details

${escalation.context.error}

---

## Workflow Progress

### Execution Result
${workflow.execution_result ? '✅ Completed' : '❌ Not completed'}
${workflow.execution_result ? `\n\`\`\`json\n${JSON.stringify(workflow.execution_result, null, 2)}\n\`\`\`` : ''}

### Detection Result
${workflow.detection_result ? '✅ Completed' : '❌ Not completed'}
${workflow.detection_result ? `\n- Red flags detected: ${workflow.detection_result.redFlags?.length || 0}` : ''}

### Verification Result
${workflow.verification_result ? '✅ Completed' : '❌ Not completed'}
${workflow.verification_result ? `\n- Verified: ${workflow.verification_result.verified}\n- Confidence: ${workflow.verification_result.confidenceScore}%` : ''}

### Fixing Result
${workflow.fixing_result ? '✅ Attempted' : '❌ Not attempted'}
${workflow.fixing_result ? `\n- Success: ${workflow.fixing_result.success}\n- Strategy: ${workflow.fixing_result.fixStrategy}` : ''}

### Learning Result
${workflow.learning_result ? '✅ Completed' : '❌ Not completed'}
${workflow.learning_result ? `\n- Patterns extracted: ${workflow.learning_result.patterns?.length || 0}` : ''}

---

## Next Steps

1. **Review Error**: Examine error details and workflow progress above
2. **Check Evidence**: Review test evidence in \`test-evidence/${workflow.test_id}/\`
3. **Manual Fix**: Apply fix manually if automated fix failed
4. **Resume Workflow**: Run \`npm run workflow:resume ${workflow.id}\` after fix
5. **Update Documentation**: Document fix in learning store if successful

---

## Commands to Resume

\`\`\`bash
# View full workflow state
npm run workflow:status ${workflow.id}

# View test evidence
ls -la test-evidence/${workflow.test_id}/

# Resume workflow (after manual fix)
npm run workflow:resume ${workflow.id}
\`\`\`

---

**Created**: ${escalation.createdAt.toISOString()}
**Handoff File**: ${filename}
`;

    // Ensure handoff directory exists
    await fs.mkdir(this.handoffDir, { recursive: true });

    // Write handoff document
    await fs.writeFile(filepath, handoff, 'utf-8');

    console.log(`Handoff document created: ${filepath}`);

    return filepath;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /temporary/i,
      /transient/i,
      /rate limit/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Set maximum retries
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * Get maximum retries
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }
}
