# Principles for Error Handling and Code Modification

When modifying code or handling errors, adhere to the following principles across both client-side and server-side development:

1.  **Avoid Naive Fallbacks:**
    *   Do not implement fallback logic that merely masks underlying problems when an error occurs. Treat critical errors (e.g., missing dependencies, failed essential operations like image conversion) as explicit failures and interrupt the process accordingly, rather than hiding the issue.
2.  **Specific and Purposeful Error Handling:**
    *   Use `try...catch` blocks judiciously, targeting specific, expected error types. Implement error handling logic that is directly related to the caught error's context. Avoid complex alternative logic within `catch` blocks as a general rule.
3.  **Clear Error Reporting:**
    *   When an error occurs, generate clear, informative error messages that explain the cause and context. Include these messages in logs and/or responses to the client to facilitate debugging and understanding.
4.  **Code Cleanup During Refactoring:**
    *   When refactoring or modifying code, completely remove obsolete logic, unused code snippets, and commented-out code blocks. Maintain code clarity and eliminate potentially confusing remnants. Ensure the codebase reflects only the current, intended logic.
5.  **Validate Inputs, Trust Internal Data:**
    *   Perform validation primarily at the input boundaries of your system (e.g., user input, API request parameters). Assume data retrieved from trusted internal sources (like your database) is valid according to the established schema or format.
    *   Do not add redundant checks or parsing validation for internal data (e.g., assuming a date string from the DB might be unparsable). This adds unnecessary complexity and noise.
    *   If unexpected data corruption *does* occur from an internal source (which should be rare and indicates a deeper issue), allow the system's natural exception handling mechanisms (e.g., a parsing error) to signal the problem rather than implementing preemptive, speculative checks.
6.  **Avoid Redundant Default Values for Trusted Data:**
    *   Building upon Principle 5, when working with data retrieved from trusted internal sources (e.g., the application's database where schema and integrity are controlled), avoid adding defensive code like nullish coalescing (`??`) or optional chaining (`?.`) solely to provide default values for properties that *should* always exist according to the established data model.
    *   Such patterns can mask underlying data integrity issues or bugs in data creation/migration logic. Assume the data conforms to the expected structure. If a required property is unexpectedly missing, it signifies a deeper problem that should surface as an error (e.g., `TypeError: Cannot read properties of undefined`), rather than being silently handled by a default value.
