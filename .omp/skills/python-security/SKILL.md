---
name: python-security
description: Security guidelines and tools for Python projects
---

# Python Security

## Purpose

Guide agents through auditing Python applications.

## Key Areas

1. **Deserialization**: Never use `pickle` for untrusted data. Use `json`. Ensure `yaml.safe_load` instead of `yaml.load`.
2. **Command Injection**: Avoid `os.system` or `subprocess.Popen` with `shell=True`.
3. **SQL Injection**: Use ORMs or parameterized queries.
4. **Asserts**: Don't use `assert` for security checks (they are removed in optimized runs `-O`).

## Tools

- `bandit`: `bandit -r .`
- `safety`: `safety check`
