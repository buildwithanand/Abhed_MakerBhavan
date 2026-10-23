# Contributing

Thanks for contributing to ABHED. Please keep the distinction between **sample data**, **sensor measurements**, and **operator-verified incidents** explicit in code and documentation.

## Before opening a pull request

1. Run `pytest -q`.
2. Add tests for new API routes or state transitions.
3. Validate input at the API boundary and avoid logging credentials, raw audio, imagery, or sensitive location data.
4. Document hardware assumptions, units, calibration, and failure modes.
5. Keep sensor protocol-specific code in an adapter rather than mixing it into the dashboard.

## Pull request checklist

- [ ] Behaviour and limitations documented
- [ ] No secrets or real operational data committed
- [ ] Input validation and expected error cases covered
- [ ] UI works on desktop and a narrow/mobile viewport
- [ ] Tests pass locally
