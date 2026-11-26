# Mellea for GRC

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)

Tutorial for building GRC automation with Mellea and LLMs. Covers SOC2/ISO 27001 compliance checking, policy validation, control testing, and policy-as-code.

## Quick Start

**Colab:** Open your copy of `grc-tutorial.ipynb` in Colab and run the cells in order.

**Local:**
```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Get models
ollama serve &
ollama pull granite3.3:8b
ollama pull llama3.2:3b

# Install Mellea
pip install "mellea[all] @ git+https://github.com/generative-computing/mellea@v0.0.5"

# Run
jupyter notebook grc-tutorial.ipynb
```

First run downloads ~4GB model weights.

## Labs

1. **SOC2 Compliance Checking** - Query requirements, generate access policies
2. **IVR Policy Validation** - Password policy generation with automated validation
3. **Evidence Analysis** - Composable assessment pipelines with `@generative`
4. **Document Processing** - Extract/analyze compliance tables from PDFs
5. **Policy-as-Code** - Version-controlled SOC2 control database with MObjects

## Use Cases

- Compliance checking (SOC2, ISO 27001)
- Risk assessment and identification
- Control testing automation
- Policy generation from requirements
- GitOps workflows for GRC

## Stack

- **Mellea** - LLM framework with IVR pattern
- **Ollama** - Local LLM runtime
- **Granite 3.3 (8B)** - IBM's open-source model
- **Docling** - Document/table processing

## Validation

All notebook code cells pass syntax checks (`37/37`).

## Resources

- [Mellea Documentation](https://docs.mellea.ai)
- [Mellea GitHub](https://github.com/generative-computing/mellea)
- [Ollama](https://github.com/ollama/ollama)
- [SOC2 Framework](https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2)

## License

[MIT](./LICENSE). Mellea is subject to its own license.
