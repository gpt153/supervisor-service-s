# Epic: Requirements Analysis Engine

**Epic ID:** 023
**Created:** 2026-01-22
**Status:** Planned
**Complexity Level:** 3
**Feature:** UI-First Development Workflow

## Project Context

- **Project:** supervisor-service-s (Meta Infrastructure)
- **Tech Stack:** TypeScript, PostgreSQL, NLP/text parsing
- **Related Epics:** 022 (Design System), 024-025 (Design Generation), 028 (Validation)
- **Purpose:** Automatically extract UI requirements from epic acceptance criteria to ensure traceability

## Business Context

### Problem Statement
UI designs often miss requirements because:
- Manual extraction of UI needs from epics is error-prone
- No systematic way to map UI elements to acceptance criteria
- Designers don't know what the UI must accomplish
- Validation requires manually checking UI against requirements

### User Value
**For Project Supervisors:**
- Automatically identify what UI elements are needed from epic
- Ensure every acceptance criterion has corresponding UI
- Traceability: Know which UI element satisfies which requirement
- Automated validation that UI meets requirements

**For End Users:**
- UIs that actually solve their problems
- No missing functionality in interface
- Complete feature implementations

### Success Metrics
- 100% of acceptance criteria mapped to UI requirements
- < 5 minutes to analyze epic and extract UI requirements
- Zero missed requirements in UI validation
- Traceability reports generated automatically

## Requirements

### Functional Requirements (MoSCoW)

**MUST HAVE:**
- [ ] Parse epic markdown files from .bmad/epics/
- [ ] Extract acceptance criteria from "Acceptance Criteria" section
- [ ] Identify UI-related requirements (forms, buttons, displays, interactions)
- [ ] Generate structured UI requirements specification
- [ ] Store requirements in ui_requirements table with epic_id and AC mapping
- [ ] MCP tool: ui_analyze_epic(epicId) returns UI requirements

**SHOULD HAVE:**
- [ ] NLP-based categorization (form, display, interaction, validation)
- [ ] Suggest component types (Button, Input, Table, etc.)
- [ ] Extract data entities (User, Order, Product)
- [ ] Identify workflows (login flow, checkout flow)

**COULD HAVE:**
- [ ] AI-assisted requirement refinement
- [ ] Duplicate requirement detection
- [ ] Requirement prioritization (must-have vs nice-to-have)

**WON'T HAVE (this iteration):**
- Visual mockup generation (separate epic)
- Natural language understanding of free-form descriptions
- Multi-epic requirement aggregation

### Non-Functional Requirements

**Performance:**
- Epic analysis completes in < 5 seconds
- Database queries < 100ms

**Accuracy:**
- 95%+ of UI-related acceptance criteria identified
- < 5% false positives (non-UI flagged as UI)

## Architecture

### Technical Approach
**Pattern:** Parser → Analyzer → Structured Output
**Input:** Epic markdown file
**Output:** Structured UI requirements (JSONB)
**Storage:** ui_requirements table with epic_id foreign key

### Database Schema
```sql
CREATE TABLE ui_requirements (
  id SERIAL PRIMARY KEY,
  epic_id TEXT NOT NULL,
  acceptance_criteria_id TEXT NOT NULL, -- e.g., "AC-1", "AC-2"
  ui_element_type TEXT NOT NULL, -- 'component', 'flow', 'interaction', 'validation'
  component_name TEXT, -- suggested component name
  requirements_satisfied JSONB, -- [AC-1, AC-2]
  mockup_id INTEGER REFERENCES ui_mockups(id),
  extracted_text TEXT, -- original AC text
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Parsing Algorithm
```
1. Read epic file (e.g., .bmad/epics/epic-003-authentication.md)
2. Extract "Acceptance Criteria" section
3. For each AC:
   a. Check for UI keywords (user can, displays, shows, form, button)
   b. Extract entities (login form, dashboard, profile page)
   c. Categorize type (form input, data display, interaction)
   d. Suggest component (LoginForm, UserProfile, etc.)
4. Generate structured requirements JSONB
5. Store in ui_requirements table
```

### Files to Create/Modify
```
/home/samuel/sv/supervisor-service-s/
├── src/ui/
│   ├── RequirementsAnalyzer.ts     # Core parser and analyzer
│   ├── EpicParser.ts               # Markdown parsing
│   └── UIPatternMatcher.ts         # Pattern matching for UI elements
├── migrations/
│   └── 023-create-ui-requirements.sql
└── src/mcp/tools/
    └── ui-tools.ts                 # Add: ui_analyze_epic
```

## Implementation Tasks

**Task 1: Database Setup**
- [ ] Create migration: 023-create-ui-requirements.sql
- [ ] Add ui_requirements table
- [ ] Test migration

**Task 2: Epic Parser**
- [ ] Create EpicParser.ts
- [ ] Parse markdown structure (sections, lists)
- [ ] Extract acceptance criteria items
- [ ] Handle various AC formats (numbered, bulleted, checkboxes)

**Task 3: Requirements Analyzer**
- [ ] Create RequirementsAnalyzer.ts
- [ ] Implement analyzeEpic(epicId)
- [ ] Keyword matching for UI elements
- [ ] Entity extraction (forms, pages, components)
- [ ] Component name suggestions

**Task 4: Pattern Matching**
- [ ] Create UIPatternMatcher.ts
- [ ] Define UI keyword patterns (form, button, displays, shows)
- [ ] Categorize requirements (form, display, interaction, validation)
- [ ] Suggest component types

**Task 5: MCP Tool**
- [ ] Add ui_analyze_epic to ui-tools.ts
- [ ] Return structured requirements as JSON
- [ ] Store results in database

### Estimated Effort
- Database: 1 hour
- Epic Parser: 3 hours
- Requirements Analyzer: 4 hours
- Pattern Matching: 3 hours
- MCP Tool: 1 hour
- **Total: 12 hours (1.5 days)**

## Acceptance Criteria

**Feature-Level Acceptance:**
- [ ] ui_analyze_epic(epicId) successfully parses epic file
- [ ] Extracts all acceptance criteria from epic
- [ ] Identifies 95%+ of UI-related requirements
- [ ] Stores requirements in ui_requirements table with epic_id
- [ ] Returns structured JSON with component suggestions

**Code Quality:**
- [ ] Handles malformed markdown gracefully
- [ ] Validates epic_id exists before parsing
- [ ] Error handling for missing files
- [ ] Unit tests for parser and analyzer

**Example Output:**
```json
{
  "epic_id": "epic-003",
  "ui_requirements": [
    {
      "ac_id": "AC-1",
      "text": "User can enter email and password on login form",
      "type": "form",
      "component_suggestion": "LoginForm",
      "required_fields": ["email", "password"]
    },
    {
      "ac_id": "AC-2",
      "text": "Dashboard displays user profile and recent activity",
      "type": "display",
      "component_suggestion": "Dashboard"
    }
  ]
}
```

## Dependencies

**Blocked By:**
- None

**Blocks:**
- Epic 024: Frame0 Design Generation (uses requirements as input)
- Epic 028: Requirements Validation (validates against these requirements)

**External Dependencies:**
- Epic files in .bmad/epics/

## Testing Strategy

### Test Cases
1. Parse epic with standard AC format → All ACs extracted
2. Parse epic with UI keywords → UI requirements identified
3. Parse epic with no UI requirements → Empty result
4. Parse malformed epic → Graceful error
5. Analyze epic-003 (authentication) → Login form, dashboard identified

## Notes

### Pattern Examples

**UI Keywords:**
- "user can enter" → Form input
- "displays" / "shows" → Data display
- "clicks button" / "submits" → Interaction
- "validates" / "checks" → Validation

**Component Suggestions:**
- "login form" → LoginForm
- "dashboard" → Dashboard
- "profile page" → UserProfile
- "list of orders" → OrderList
