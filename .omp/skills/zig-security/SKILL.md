---
name: zig-security
description: Security guidelines and memory safety for Zig projects
---

# Zig Security

## Purpose

Guide agents through Zig memory safety and security.

## Key Areas

1. **Memory Leaks & UAF**: Use `std.testing.allocator` in tests to catch leaks. Avoid dangling pointers when returning slices.
2. **Casts**: Scrutinize `@ptrCast` and `@alignCast`.
3. **Bounds Checks**: Be careful with `ReleaseFast` and `ReleaseSmall` which disable bounds checks. Prefer `ReleaseSafe` for security-critical binaries.
4. **FFI**: Validate all inputs at the C/Zig boundary.

## Tools

- Built-in Zig test framework with memory leak detection.
- Valgrind
