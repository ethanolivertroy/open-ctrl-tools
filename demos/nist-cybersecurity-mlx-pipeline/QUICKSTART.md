# Quick Start

Start here on a fresh machine.

On an Apple Silicon Mac, this should get you from raw NIST documents to a local dataset and, if you want, a fine-tuned MLX model.

## 1. Set up the environment

```bash
make setup
source .venv/bin/activate
```

The first setup is not tiny. It installs Docling, MLX, Torch, and the fallback PDF stack.

If you already use your own virtual environment, that's fine too. The scripts will work with either `.venv/` or `venv/`.

## 2. Run a small sample first

Download a small representative set first:

```bash
make sample-download SAMPLE_DOCS=2
```

This writes PDFs to `data/raw/`.

## 3. Extract documents

Run the hybrid extractor:

```bash
make extract
```

The first extraction run will download Docling model weights from Hugging Face. On a clean machine that can take a few minutes before you see useful output, especially if one of the sampled PDFs is large.

You should see:

- `data/extracted/*.json`
- `data/extracted/*.md`
- `data/extracted/extraction_report.json`

If one PDF is especially stubborn, use:

```bash
python src/extract_single_pdf.py path/to/file.pdf --output data/extracted
```

## 4. Generate training data

```bash
make prepare
```

This generates:

- `data/training/train.jsonl`
- `data/training/valid.jsonl`
- `data/training/data_stats.json`

The prep step in this repo deduplicates by document stem and prefers JSON over Markdown when both exist.

## 5. Fine-tune the model

Update [`config/training_config.yaml`](config/training_config.yaml) if you want different batch sizes, output paths, or a smaller base model for QA.

Then run:

```bash
make train
```

Under the hood this runs `python src/train.py --config config/training_config.yaml --run`.

## 6. Package for Ollama

```bash
make deploy
```

If `convert_hf_to_gguf.py` and `llama-quantize` are not already on `PATH`, point the deploy step at a local `llama.cpp` checkout:

```bash
LLAMA_CPP_DIR=/path/to/llama.cpp make deploy
```

This step creates:

- `models/hackidle-nist-coder-merged/`
- `models/hackidle-nist-coder-dequantized/`
- `models/gguf/hackidle-nist-coder-f16.gguf`
- `models/gguf/hackidle-nist-coder-q4_k_m.gguf`

By default this creates an Ollama model named `hackidle-nist-coder`.

The checked-in `config/Modelfile` matches the default Qwen2.5-Coder base model. If you use a different model family during QA, point `MODELFILE_TEMPLATE` at a matching Ollama template before release.

## 7. Smoke test

```bash
ollama run hackidle-nist-coder "What does NIST SP 800-207 say about zero trust?"
```

More prompts live in [`examples/example_queries.md`](examples/example_queries.md).

If you want a repeatable local check instead of a single prompt:

```bash
make eval
```

## Full run

When you're ready for the complete workflow:

```bash
make download
make extract
make prepare
make train
make deploy
```

That is the full pipeline.


## Useful helpers

```bash
make monitor
./scripts/extract_failed.sh
python scripts/chat_with_model.py
```

If you need the extension dependencies after the base setup:

```bash
make setup-extensions
```
