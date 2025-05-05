# Diff Digest Solution

## Implementation Overview
Implemented a web application that fetches Git diffs and generates dual-tone release notes using OpenAI's API. The application streams the generated notes in real-time to provide an interactive user experience.

## Features
- Fetches PR diffs from GitHub repositories
- Generates developer and marketing release notes
- Streams responses in real-time using SSE
- Handles edge cases like network failures and malformed JSON

## Technical Decisions
- Used the ReadableStream API for streaming instead of WebSockets for simplicity and lower overhead
- Implemented a section-based approach to display partial streaming content
- Designed the prompt to generate consistent, well-formatted outputs