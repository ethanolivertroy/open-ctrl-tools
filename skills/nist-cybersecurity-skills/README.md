# nist-cybersecurity-skills

Agent skill and Python lookup utility for NIST cybersecurity publications and control families.

## Frameworks Covered

- SP 800-53 Rev 5: Security and Privacy Controls (all 20 families)
- SP 800-171 Rev 3: Protecting Controlled Unclassified Information (CUI)
- SP 800-53A Rev 5: Assessment Procedures
- CSF 2.0: Cybersecurity Framework (6 functions, categories, subcategories)
- SP 800-37 Rev 2: Risk Management Framework
- SP 800-207: Zero Trust Architecture
- SP 800-30 Rev 1: Risk Assessment Guide
- SP 800-61 Rev 3: Incident Response
- SP 800-63 Rev 4: Digital Identity Guidelines
- SP 800-161 Rev 1: Supply Chain Risk Management
- FIPS: 140-3, 199, 200, 201

## Local use

From this directory, open [the skill](skills/nist-cybersecurity-skills/SKILL.md) or run `python3 scripts/lookup.py --help` to see available lookup commands.

## Structure

```text
skills/nist-cybersecurity-skills/
  SKILL.md                              Main entry point (framework routing, quick reference)
references/800-53/                      SP 800-53 Rev 5 control families
references/800-171/                     SP 800-171 Rev 3
references/800-53a/                     SP 800-53A assessment procedures
references/csf/                         CSF 2.0 functions
references/800-37/                      Risk Management Framework
references/800-207/                     Zero Trust Architecture
references/800-30/                      Risk Assessment
references/800-61/                      Incident Response
references/800-63/                      Digital Identity
references/800-161/                     Supply Chain Risk Management
references/fips/                        FIPS standards
references/cross-references/            Framework mappings and baselines
references/glossary.md                  NIST cybersecurity terms
scripts/                                Lookup utility
assets/                                 Structured control-family data
```

## License

MIT. See [LICENSE](LICENSE).

Scripts, `SKILL.md`, and cross-reference mappings are original work. The Markdown content under `references/` is derived from U.S. government NIST publications (public domain).

## Data Sources

- [`ethanolivertroy/nist-cybersecurity-training`](https://huggingface.co/datasets/ethanolivertroy/nist-cybersecurity-training): 530,912 structured examples from 596 NIST publications
- [`ethanolivertroy/nist-publications-raw`](https://huggingface.co/datasets/ethanolivertroy/nist-publications-raw): 596 source PDFs
