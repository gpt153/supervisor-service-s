/**
 * BMAD Epic Parser
 *
 * Parses BMAD epic markdown files into structured data
 */

export interface BMADMetadata {
  status: string;
  priority: string;
  effort: string;
  epicType?: string;
  target?: string;
  dependsOn?: string[];
  completed?: string;
}

export interface AcceptanceCriterion {
  section: string;
  criterion: string;
  checked: boolean;
}

export interface BMADEpic {
  id: string;
  title: string;
  filePath: string;
  metadata: BMADMetadata;
  overview: string;
  goals: string[];
  userStories: string[];
  technicalRequirements: Record<string, string>;
  acceptanceCriteria: AcceptanceCriterion[];
  testingStrategy: string;
  technicalDecisions: string;
  relatedEpics: string;
  implementationNotes: string[];
  documentation: string[];
}

/**
 * Parse BMAD epic markdown file
 */
export function parseBMADEpic(content: string, filePath: string): BMADEpic {
  const lines = content.split('\n');

  // Extract title (first h1)
  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine ? titleLine.replace(/^# /, '').trim() : 'Untitled Epic';

  // Extract ID from title (e.g., "Epic 001: Title" → "epic-001")
  const idMatch = title.match(/Epic (\d+)/i);
  const id = idMatch ? `epic-${idMatch[1].padStart(3, '0')}` : 'epic-unknown';

  // Parse metadata (lines with **Key:** Value format)
  const metadata: BMADMetadata = {
    status: '',
    priority: '',
    effort: '',
  };

  for (const line of lines.slice(0, 20)) {
    const statusMatch = line.match(/\*\*Status:\*\*\s*(.+)/);
    if (statusMatch) metadata.status = statusMatch[1].trim();

    const priorityMatch = line.match(/\*\*Priority:\*\*\s*(.+)/);
    if (priorityMatch) metadata.priority = priorityMatch[1].trim();

    const effortMatch = line.match(/\*\*Estimated Effort:\*\*\s*(.+)/);
    if (effortMatch) metadata.effort = effortMatch[1].trim();

    const typeMatch = line.match(/\*\*Epic Type:\*\*\s*(.+)/);
    if (typeMatch) metadata.epicType = typeMatch[1].trim();

    const targetMatch = line.match(/\*\*Target:\*\*\s*(.+)/);
    if (targetMatch) metadata.target = targetMatch[1].trim();

    const completedMatch = line.match(/\*\*Completed:\*\*\s*(.+)/);
    if (completedMatch) metadata.completed = completedMatch[1].trim();

    const dependsMatch = line.match(/\*\*Depends On:\*\*\s*(.+)/);
    if (dependsMatch) {
      const deps = dependsMatch[1].split(',').map(d => d.trim());
      metadata.dependsOn = deps;
    }
  }

  // Extract sections
  const overview = extractSection(content, '## Overview');
  const goals = extractListSection(content, '## Goals');
  const userStories = extractListSection(content, '## User Stories');
  const implementationNotes = extractNumberedList(content, '## Implementation Notes');
  const documentation = extractListSection(content, '## Documentation');

  // Extract technical requirements (subsections)
  const technicalRequirements = extractSubsections(content, '## Technical Requirements');

  // Extract acceptance criteria (checkboxes grouped by subsection)
  const acceptanceCriteria = extractAcceptanceCriteria(content);

  // Extract other sections as raw text
  const testingStrategy = extractSection(content, '## Testing Strategy');
  const technicalDecisions = extractSection(content, '## Technical Decisions');
  const relatedEpics = extractSection(content, '## Related Epics');

  return {
    id,
    title,
    filePath,
    metadata,
    overview,
    goals,
    userStories,
    technicalRequirements,
    acceptanceCriteria,
    testingStrategy,
    technicalDecisions,
    relatedEpics,
    implementationNotes,
    documentation,
  };
}

/**
 * Extract a section's content
 */
function extractSection(content: string, header: string): string {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === header);

  if (startIdx === -1) return '';

  const endIdx = lines.findIndex((l, idx) => {
    return idx > startIdx && l.match(/^##\s+/);
  });

  const sectionLines = lines.slice(
    startIdx + 1,
    endIdx === -1 ? undefined : endIdx
  );

  return sectionLines.join('\n').trim();
}

/**
 * Extract bulleted or numbered list items from a section
 */
function extractListSection(content: string, header: string): string[] {
  const section = extractSection(content, header);
  const lines = section.split('\n');

  const items: string[] = [];
  for (const line of lines) {
    const match = line.match(/^[\d\-\*]\.\s*(.+)/) || line.match(/^[\-\*]\s+(.+)/);
    if (match) {
      items.push(match[1].trim());
    }
  }

  return items;
}

/**
 * Extract numbered list (e.g., Implementation Notes)
 */
function extractNumberedList(content: string, header: string): string[] {
  const section = extractSection(content, header);
  const lines = section.split('\n');

  const items: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\d+\.\s+(.+)/);
    if (match) {
      items.push(match[1].trim());
    }
  }

  return items;
}

/**
 * Extract subsections (e.g., Technical Requirements has ### Database Setup, ### Models)
 */
function extractSubsections(content: string, header: string): Record<string, string> {
  const section = extractSection(content, header);
  const lines = section.split('\n');

  const subsections: Record<string, string> = {};
  let currentSubsection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(/^###\s+(.+)/);
    if (match) {
      // Save previous subsection
      if (currentSubsection) {
        subsections[currentSubsection] = currentContent.join('\n').trim();
      }

      // Start new subsection
      currentSubsection = match[1].trim();
      currentContent = [];
    } else if (currentSubsection) {
      currentContent.push(line);
    }
  }

  // Save last subsection
  if (currentSubsection) {
    subsections[currentSubsection] = currentContent.join('\n').trim();
  }

  return subsections;
}

/**
 * Extract acceptance criteria (checkboxes grouped by subsection)
 */
function extractAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const section = extractSection(content, '## Acceptance Criteria');
  const lines = section.split('\n');

  const criteria: AcceptanceCriterion[] = [];
  let currentSection = 'General';

  for (const line of lines) {
    // Check for subsection header
    const sectionMatch = line.match(/^###\s+(.+)/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // Check for checkbox item
    const checkboxMatch = line.match(/^-\s+\[([ x])\]\s+(.+)/);
    if (checkboxMatch) {
      criteria.push({
        section: currentSection,
        criterion: checkboxMatch[2].trim(),
        checked: checkboxMatch[1] === 'x',
      });
    }
  }

  return criteria;
}

/**
 * Get implementation notes (numbered list)
 */
export function getImplementationNotes(epic: BMADEpic): string[] {
  return epic.implementationNotes;
}

/**
 * Get unchecked acceptance criteria
 */
export function getUnmetCriteria(epic: BMADEpic): AcceptanceCriterion[] {
  return epic.acceptanceCriteria.filter(c => !c.checked);
}

/**
 * Get all acceptance criteria
 */
export function getAllCriteria(epic: BMADEpic): AcceptanceCriterion[] {
  return epic.acceptanceCriteria;
}
