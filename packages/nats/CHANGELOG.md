# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2023-05-12

### Fixed
- Fixed TypeScript compilation errors:
  - Removed invalid `super()` call in NatsTransport constructor
  - Added null check for NATS connection before accessing status
  - Fixed type reference for NATS headers in processSubscription method

## [0.1.1] - 2023-09-15

### Changed
- Updated repository links to point to monorepo structure
- Enhanced documentation with badges and contributing guidelines
- Improved package metadata for better discoverability

## [0.1.0] - 2023-09-14

### Added
- Initial release of the NATS transport provider
- Implementation of NatsTransportFactory
- Implementation of NatsTransport with connection management
- Support for request-response pattern
- Support for publish-subscribe event pattern
- Customizable subject configuration
- Comprehensive test suite
- Documentation and examples