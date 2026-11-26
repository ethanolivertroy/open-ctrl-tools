# Example queries for `hackidle-nist-coder`

Use these to see whether the model is actually grounded in NIST material or just giving generic security advice.

If you want a quick automated pass first, run:

```bash
make eval
```

## Grounding checks

```bash
ollama run hackidle-nist-coder "What does NIST SP 800-207 say zero trust is, and what are the core logical components in the reference architecture?"
```

```bash
ollama run hackidle-nist-coder "Summarize the RMF steps from NIST SP 800-37 Rev. 2."
```

```bash
ollama run hackidle-nist-coder "What changed between FIPS 140-2 and FIPS 140-3?"
```

## Practical questions

```bash
ollama run hackidle-nist-coder "I need to roll out MFA for a mixed Windows and SaaS environment. Which parts of SP 800-63 should I read first, and what decisions do they drive?"
```

```bash
ollama run hackidle-nist-coder "Map a basic onboarding and offboarding process to the most relevant access control families in SP 800-53 Rev. 5."
```

```bash
ollama run hackidle-nist-coder "What would a reasonable first pass at a zero trust migration plan look like for a hybrid cloud environment if you stayed close to NIST guidance?"
```

## Cross-document checks

```bash
ollama run hackidle-nist-coder "How do CSF 2.0 and the RMF relate to each other in practice?"
```

```bash
ollama run hackidle-nist-coder "How do SP 800-61 incident response guidance and SP 800-53 logging and monitoring controls fit together?"
```

## Hallucination checks

```bash
ollama run hackidle-nist-coder "Which NIST publication defines control CM-6? Give the control name and explain what it covers."
```

```bash
ollama run hackidle-nist-coder "What does NIST say about shared responsibility in cloud environments? Name the publication if you can. If you are not sure, say that."
```

## Interactive chat example

```bash
ollama run hackidle-nist-coder
```

Then in the chat:

```text
>>> I need to tighten remote access for contractors. Which NIST publications should I start with?

>>> Which SP 800-53 control families matter most here?

>>> How would you separate MFA guidance from session management guidance?

>>> Where would zero trust ideas help, and where would they not?
```

## Programmatic usage (Python)

```python
import requests

def query_nist_expert(question):
    response = requests.post('http://localhost:11434/api/generate',
        json={
            'model': 'hackidle-nist-coder',
            'prompt': question,
            'stream': False
        })
    return response.json()['response']

# Example
answer = query_nist_expert("Summarize the core ideas in NIST SP 800-207.")
print(answer)
```

## What good answers look like

- cites specific NIST publications instead of hand-waving
- uses the right control IDs, document names, and revision numbers
- gives practical guidance without drifting into generic security boilerplate
- says when it is not sure instead of inventing an answer
- connects related publications without pretending they all say the same thing

## Red flags

- made-up document numbers, control names, or revision numbers
- generic security advice with no NIST grounding
- answers that sound confident but never name a source document
- contradictions between publications that the model does not notice
