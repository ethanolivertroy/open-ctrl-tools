# OSCAL CLI

Go command-line tool for validating and converting [OSCAL](https://pages.nist.gov/OSCAL/) documents (XML, JSON, YAML).

## Capabilities

- Converts OSCAL catalogs, profiles, SSPs, component definitions, assessment plans/results, and POA&Ms between XML, JSON, and YAML with format auto-detection (parses the full 10 MB NIST 800-53 catalog in ~0.1s)
- Validates documents against embedded NIST OSCAL 1.1.3 JSON Schemas
- Builds as a ~6 MB static binary for macOS, Linux, and Windows with no external runtime dependencies

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/tools/oscal-cli

# Build
make build

# Or install to your GOPATH/bin
make install
```

## Usage

### Validate Command

Validate OSCAL documents against official NIST JSON schemas:

```bash
# Validate a catalog
oscal validate catalog.json

# Validate an XML document (auto-converted internally)
oscal validate ssp.xml

# Quiet mode (only output errors)
oscal validate catalog.json --quiet
```

The embedded schemas correspond to OSCAL version 1.1.3.

### Convert Command

Convert OSCAL documents between formats:

```bash
# Convert JSON to XML
oscal convert catalog.json --to xml

# Convert XML to YAML with output file
oscal convert catalog.xml --to yaml --output catalog.yaml

# Convert and redirect to file
oscal convert catalog.xml --to json > catalog.json

# Overwrite existing output file
oscal convert catalog.json --to xml --output catalog.xml --overwrite
```

### Supported Document Types

- Catalog
- Profile
- System Security Plan (SSP)
- Component Definition
- Assessment Plan
- Assessment Results
- Plan of Action and Milestones (POA&M)

### Version

```bash
oscal version
```

## Development

### Prerequisites

- Go 1.21 or later
- Make (optional, for convenience commands)

### Building

```bash
# Build for current platform
make build

# Build for all platforms
make build-all

# Run tests
make test

# Clean build artifacts
make clean
```

### Project Structure

```
oscal-cli/
├── cmd/oscal/          # CLI entry point
├── internal/cli/       # CLI commands (cobra)
├── pkg/oscal/
│   ├── model/          # OSCAL document types
│   ├── io/             # Format detection, load/save
│   └── validate/       # Validation (future)
└── testdata/           # Test fixtures
```

## Roadmap

- [x] `validate` command with JSON Schema validation
- [ ] Profile resolution (`profile resolve`)
- [ ] HTML rendering (`catalog render`)
- [ ] OSCAL constraint validation (beyond schema)

## License

MIT License for the Go CLI ([LICENSE](LICENSE)). Embedded NIST OSCAL schemas remain in the public domain under the NIST Software License / CC0 1.0 (see [NOTICE](NOTICE)).

## Acknowledgments

This project is a Go rewrite of NIST's [oscal-cli](https://github.com/usnistgov/oscal-cli), originally written in Java. Thanks to NIST and the OSCAL team for their work on the original tool and the OSCAL specification.

## Related Projects

- [NIST OSCAL](https://pages.nist.gov/OSCAL/) - Official OSCAL specification
- [oscal-cli (Java)](https://github.com/usnistgov/oscal-cli) - NIST's original Java CLI (this project's inspiration)
- [liboscal-java](https://github.com/usnistgov/liboscal-java) - NIST's Java OSCAL library
- [go-oscal](https://github.com/defenseunicorns/go-oscal) - Defense Unicorns Go OSCAL library
