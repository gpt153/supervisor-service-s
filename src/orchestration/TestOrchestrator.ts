/**
 * Epic 006-G: Test Orchestrator
 *
 * Main coordinator for test workflow orchestration
 */

import type {
  OrchestrationTestDefinition,
  TestWorkflowResult,
  StageContext
} from '../types/orchestration.js';
import { WorkflowStateMachine } from './WorkflowStateMachine.js';
import { StageExecutor } from './StageExecutor.js';
import { ErrorHandler } from './ErrorHandler.js';
import { UnifiedReporter } from './UnifiedReporter.js';

/**
 * Orchestrates test workflows through all stages
 */
export class TestOrchestrator {
  private stateMachine: WorkflowStateMachine;
  private stageExecutor: StageExecutor;
  private errorHandler: ErrorHandler;
  private reporter: UnifiedReporter;

  constructor() {
    this.stateMachine = new WorkflowStateMachine();
    this.stageExecutor = new StageExecutor();
    this.reporter = new UnifiedReporter();
    this.errorHandler = new ErrorHandler(this.stateMachine, this.reporter);
  }

  /**
   * Orchestrate full test workflow
   */
  async orchestrate(testDefinition: OrchestrationTestDefinition): Promise<TestWorkflowResult> {
    console.log(`Starting workflow orchestration for test: ${testDefinition.id}`);

    try {
      // Create workflow state
      const workflow = await this.stateMachine.create({
        test_id: testDefinition.id,
        epic_id: testDefinition.epic_id,
        test_type: testDefinition.type
      });

      // Stage 1: Test Execution
      console.log(`[${testDefinition.id}] Stage 1: Test Execution`);
      await this.stateMachine.transitionTo(workflow, 'execution');

      const executionResult = await this.stageExecutor.execute('execution', {
        workflow,
        testDefinition
      });

      if (!executionResult.success) {
        throw new Error(`Execution failed: ${executionResult.error}`);
      }

      await this.stateMachine.storeExecutionResult(workflow, executionResult.data);
      workflow.execution_result = executionResult.data;

      // Stage 2: Red Flag Detection
      console.log(`[${testDefinition.id}] Stage 2: Red Flag Detection`);
      await this.stateMachine.transitionTo(workflow, 'detection');

      const detectionResult = await this.stageExecutor.execute('detection', {
        workflow,
        testDefinition,
        previousResults: {
          execution: executionResult.data
        }
      });

      if (!detectionResult.success) {
        throw new Error(`Detection failed: ${detectionResult.error}`);
      }

      await this.stateMachine.storeDetectionResult(workflow, detectionResult.data);
      workflow.detection_result = detectionResult.data;

      console.log(
        `[${testDefinition.id}] Red flags detected: ${detectionResult.data.redFlags.length}`
      );

      // Stage 3: Independent Verification
      console.log(`[${testDefinition.id}] Stage 3: Independent Verification`);
      await this.stateMachine.transitionTo(workflow, 'verification');

      const verificationResult = await this.stageExecutor.execute('verification', {
        workflow,
        testDefinition,
        previousResults: {
          execution: executionResult.data,
          detection: detectionResult.data
        }
      });

      if (!verificationResult.success) {
        throw new Error(`Verification failed: ${verificationResult.error}`);
      }

      await this.stateMachine.storeVerificationResult(workflow, verificationResult.data);
      workflow.verification_result = verificationResult.data;

      console.log(
        `[${testDefinition.id}] Verification: ${verificationResult.data.verified ? 'PASSED' : 'FAILED'} ` +
        `(confidence: ${verificationResult.data.confidenceScore}%)`
      );

      // Stage 4: Fixing (if verification failed)
      if (!verificationResult.data.verified) {
        console.log(`[${testDefinition.id}] Stage 4: Adaptive Fixing`);
        await this.stateMachine.transitionTo(workflow, 'fixing');

        const fixingResult = await this.stageExecutor.execute('fixing', {
          workflow,
          testDefinition,
          previousResults: {
            execution: executionResult.data,
            detection: detectionResult.data,
            verification: verificationResult.data
          }
        });

        if (fixingResult.success) {
          await this.stateMachine.storeFixingResult(workflow, fixingResult.data);
          workflow.fixing_result = fixingResult.data;

          console.log(
            `[${testDefinition.id}] Fix applied: ${fixingResult.data.fixStrategy} ` +
            `(success: ${fixingResult.data.success})`
          );

          // Re-verify after fix if fix was successful
          if (fixingResult.data.success) {
            console.log(`[${testDefinition.id}] Re-verifying after fix...`);

            const reVerificationResult = await this.stageExecutor.execute('verification', {
              workflow,
              testDefinition,
              previousResults: {
                execution: executionResult.data,
                detection: detectionResult.data,
                verification: verificationResult.data,
                fixing: fixingResult.data
              }
            });

            if (!reVerificationResult.success || !reVerificationResult.data.verified) {
              // Fix didn't work - escalate
              console.log(
                `[${testDefinition.id}] Fix applied but verification still failing - escalating`
              );
              return await this.errorHandler.escalate(
                workflow,
                'Fix applied but verification still failing'
              );
            }

            // Update verification result
            await this.stateMachine.storeVerificationResult(workflow, reVerificationResult.data);
            workflow.verification_result = reVerificationResult.data;

            console.log(
              `[${testDefinition.id}] Re-verification: PASSED ` +
              `(confidence: ${reVerificationResult.data.confidenceScore}%)`
            );
          }
        } else {
          // Fix failed - escalate
          console.log(
            `[${testDefinition.id}] Fix failed after ${fixingResult.retriesUsed} retries - escalating`
          );
          return await this.errorHandler.escalate(
            workflow,
            `Fix failed after ${fixingResult.retriesUsed} retries`
          );
        }
      }

      // Stage 5: Learning Extraction
      console.log(`[${testDefinition.id}] Stage 5: Learning Extraction`);
      await this.stateMachine.transitionTo(workflow, 'learning');

      const learningResult = await this.stageExecutor.execute('learning', {
        workflow,
        testDefinition,
        previousResults: {
          execution: executionResult.data,
          detection: detectionResult.data,
          verification: verificationResult.data,
          fixing: workflow.fixing_result
        }
      });

      if (learningResult.success) {
        await this.stateMachine.storeLearningResult(workflow, learningResult.data);
        workflow.learning_result = learningResult.data;

        console.log(
          `[${testDefinition.id}] Patterns extracted: ${learningResult.data.patterns.length}`
        );
      }

      // Complete workflow
      await this.stateMachine.complete(workflow);

      // Generate unified report
      const report = await this.reporter.generate(workflow);

      console.log(
        `[${testDefinition.id}] Workflow completed: ${report.passed ? 'PASSED' : 'FAILED'} ` +
        `(confidence: ${report.confidence}%)`
      );

      return {
        success: true,
        workflow,
        report
      };
    } catch (error) {
      console.error(
        `[${testDefinition.id}] Workflow error: ${error instanceof Error ? error.message : String(error)}`
      );

      // Get workflow from database (may have been updated)
      const workflow = await this.stateMachine.getWorkflowByTestId(testDefinition.id);

      if (!workflow) {
        throw new Error('Workflow not found after error');
      }

      // Handle error (retry or escalate)
      return await this.errorHandler.handle(
        workflow,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Get workflow status
   */
  async getStatus(testId: string) {
    return await this.stateMachine.getWorkflowByTestId(testId);
  }

  /**
   * Resume workflow from last successful stage
   */
  async resume(testId: string): Promise<TestWorkflowResult> {
    const workflow = await this.stateMachine.getWorkflowByTestId(testId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${testId}`);
    }

    if (workflow.status === 'completed') {
      throw new Error('Workflow already completed');
    }

    // Resume from current stage
    console.log(`Resuming workflow ${testId} from stage: ${workflow.current_stage}`);

    // Create test definition from workflow
    const testDefinition: OrchestrationTestDefinition = {
      id: workflow.test_id,
      epic_id: workflow.epic_id,
      type: workflow.test_type as 'ui' | 'api',
      priority: 'medium',
      steps: [] // Would be loaded from database
    };

    return await this.orchestrate(testDefinition);
  }
}
