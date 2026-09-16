# MOGD Exercise Relationships — Claude Code Instruction Pack

Feed these files to Claude Code in this order:

1. `01_EXERCISE_RELATIONSHIPS_ARCHITECTURE.md`
   - domain rules and conceptual architecture;
   - distinction between difficulty, muscle role and session role;
   - relationship graph;
   - contextual advanced-athlete sequencing;
   - intra- vs inter-exercise progressive overload.

2. `02_EXERCISE_RELATIONSHIPS_IMPLEMENTATION.md`
   - suggested schema;
   - inverse-edge behavior;
   - admin UI;
   - recommendation-engine integration;
   - acceptance criteria.

## Claude Code directive

Before implementing:

1. inspect the existing MOGD exercise schema, admin exercise form, recommendation/program-generation services and migrations;
2. reuse existing naming conventions, ORM/database patterns, UI components and enums;
3. produce a short implementation plan identifying affected files;
4. make the smallest coherent extension rather than redesigning the application;
5. preserve backward compatibility with existing exercise records;
6. add migrations and automated tests appropriate to the current stack.

If the existing architecture conflicts with a suggested field/table name in these instructions, preserve the **domain semantics** while adapting the implementation to the codebase.
