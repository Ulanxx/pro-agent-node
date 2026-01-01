## ADDED Requirements

### Requirement: Graph-based Workflow Execution
The system SHALL execute the PPT generation process using a structured state graph (LangGraph) to ensure consistent state transitions and modularity.

#### Scenario: Successful full-graph execution
- **WHEN** a topic is provided to the agent graph
- **THEN** it must traverse all nodes from analysis to slide generation and produce a valid PptHtmlDocument

### Requirement: State Persistence and Recovery
The system SHALL persist the execution state of the graph at each node boundary, allowing the workflow to be resumed from the last successful node in case of interruptions.

#### Scenario: Resume after interruption
- **WHEN** the generation process stops after the "courseConfig" stage
- **THEN** the system MUST be able to resume execution from the "videoOutline" stage without re-running previous stages

### Requirement: Node-level Progress Reporting
The system SHALL emit progress notifications via Socket.io as it enters and completes each node in the graph.

#### Scenario: Socket notification on node start
- **WHEN** the "analysis" node starts execution
- **THEN** a "tool:start" or "progress" event must be emitted to the client
