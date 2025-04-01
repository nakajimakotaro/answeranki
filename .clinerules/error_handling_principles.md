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
