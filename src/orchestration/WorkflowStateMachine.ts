/**
 * Epic 006-G: Workflow State Machine
 *
 * Manages workflow state transitions and persistence
 */

import type {
  TestWorkflow,
  WorkflowStage,
  WORKFLOW_TRANSITIONS,
  StateTransitionEvent,
  TestExecutionResult,
  DetectionResult,
  VerificationReport,
  FixResult,
  LearningResult
} from '../types/orchestration.js';
import * as workflowQueries from '../db/queries/workflow.js';

/**
 * Valid state transitions map
 */
const TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
  pending: ['execution'],
  execution: ['detection', 'failed'],
  detection: ['verification', 'failed'],
  verification: ['fixing', 'learning', 'failed'],
  fixing: ['verification', 'learning', 'failed'],
  learning: ['completed', 'failed'],
  completed: [],
  failed: []
};

/**
 * Workflow state machine for managing test workflow lifecycle
 */
export class WorkflowStateMachine {
  private transitionHistory: StateTransitionEvent[] = [];

  /**
   * Create a new workflow
   */
  async create(params: {
    test_id: string;
    epic_id: string;
    test_type: 'ui' | 'api' | 'unit' | 'integration';
  }): Promise<TestWorkflow> {
    const workflow = await workflowQueries.createWorkflow(params);

    this.recordTransition({
      workflowId: workflow.id,
      fromStage: 'pending' as WorkflowStage,
      toStage: 'pending' as WorkflowStage,
      timestamp: new Date(),
      reason: 'Workflow created'
    });

    return workflow;
  }

  /**
   * Transition workflow to next stage
   */
  async transitionTo(workflow: TestWorkflow, nextStage: WorkflowStage): Promise<TestWorkflow> {
    const currentStage = workflow.current_stage;

    // Validate transition
    if (!this.isValidTransition(currentStage, nextStage)) {
      throw new Error(
        `Invalid state transition: ${currentStage} → ${nextStage}. ` +
        `Valid transitions from ${currentStage}: ${TRANSITIONS[currentStage].join(', ')}`
      );
    }

    // Update database
    const updatedWorkflow = await workflowQueries.updateWorkflowStage(workflow.id, nextStage);

    // Record transition
    this.recordTransition({
      workflowId: workflow.id,
      fromStage: currentStage,
      toStage: nextStage,
      timestamp: new Date(),
      reason: `Stage transition: ${currentStage} → ${nextStage}`
    });

    return updatedWorkflow;
  }

  /**
   * Check if transition is valid
   */
  isValidTransition(fromStage: WorkflowStage, toStage: WorkflowStage): boolean {
    const validTransitions = TRANSITIONS[fromStage];
    return validTransitions.includes(toStage);
  }

  /**
   * Get valid next stages for current stage
   */
  getValidNextStages(currentStage: WorkflowStage): WorkflowStage[] {
    return TRANSITIONS[currentStage];
  }

  /**
   * Store execution result
   */
  async storeExecutionResult(
    workflow: TestWorkflow,
    result: TestExecutionResult
  ): Promise<TestWorkflow> {
    return await workflowQueries.storeExecutionResult(workflow.id, result);
  }

  /**
   * Store detection result
   */
  async storeDetectionResult(
    workflow: TestWorkflow,
    result: DetectionResult
  ): Promise<TestWorkflow> {
    return await workflowQueries.storeDetectionResult(workflow.id, result);
  }

  /**
   * Store verification result
   */
  async storeVerificationResult(
    workflow: TestWorkflow,
    result: VerificationReport
  ): Promise<TestWorkflow> {
    return await workflowQueries.storeVerificationResult(workflow.id, result);
  }

  /**
   * Store fixing result
   */
  async storeFixingResult(
    workflow: TestWorkflow,
    result: FixResult
  ): Promise<TestWorkflow> {
    return await workflowQueries.storeFixingResult(workflow.id, result);
  }

  /**
   * Store learning result
   */
  async storeLearningResult(
    workflow: TestWorkflow,
    result: LearningResult
  ): Promise<TestWorkflow> {
    return await workflowQueries.storeLearningResult(workflow.id, result);
  }

  /**
   * Mark workflow as completed
   */
  async complete(workflow: TestWorkflow): Promise<TestWorkflow> {
    const updatedWorkflow = await workflowQueries.completeWorkflow(workflow.id);

    this.recordTransition({
      workflowId: workflow.id,
      fromStage: workflow.current_stage,
      toStage: 'completed' as WorkflowStage,
      timestamp: new Date(),
      reason: 'Workflow completed successfully'
    });

    return updatedWorkflow;
  }

  /**
   * Mark workflow as failed
   */
  async fail(workflow: TestWorkflow, errorMessage: string): Promise<TestWorkflow> {
    const updatedWorkflow = await workflowQueries.failWorkflow(workflow.id, errorMessage);

    this.recordTransition({
      workflowId: workflow.id,
      fromStage: workflow.current_stage,
      toStage: 'failed' as WorkflowStage,
      timestamp: new Date(),
      reason: `Workflow failed: ${errorMessage}`
    });

    return updatedWorkflow;
  }

  /**
   * Increment retry count
   */
  async incrementRetry(workflow: TestWorkflow): Promise<TestWorkflow> {
    return await workflowQueries.incrementRetryCount(workflow.id);
  }

  /**
   * Mark workflow as escalated
   */
  async escalate(workflow: TestWorkflow): Promise<TestWorkflow> {
    return await workflowQueries.escalateWorkflow(workflow.id);
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(id: number): Promise<TestWorkflow | null> {
    return await workflowQueries.getWorkflow(id);
  }

  /**
   * Get workflow by test ID
   */
  async getWorkflowByTestId(testId: string): Promise<TestWorkflow | null> {
    return await workflowQueries.getWorkflowByTestId(testId);
  }

  /**
   * Get all workflows for epic
   */
  async getWorkflowsByEpic(epicId: string): Promise<TestWorkflow[]> {
    return await workflowQueries.getWorkflowsByEpic(epicId);
  }

  /**
   * Get transition history
   */
  getTransitionHistory(): StateTransitionEvent[] {
    return [...this.transitionHistory];
  }

  /**
   * Clear transition history (for testing)
   */
  clearTransitionHistory(): void {
    this.transitionHistory = [];
  }

  /**
   * Record transition event
   */
  private recordTransition(event: StateTransitionEvent): void {
    this.transitionHistory.push(event);
  }
}
