# NIST Cybersecurity Fine-Tuning Pipeline

Reproducible scripts for downloading public NIST CSRC publications, extracting text with Docling/MarkItDown, building training JSONL datasets, fine-tuning Qwen models with MLX LoRA on Apple Silicon, and exporting GGUF models to Ollama (plus optional CMMC/HIPAA splits and local embeddings).

Heavy artifacts (raw PDFs, extracted dumps, training JSONL files, FAISS/Parquet embeddings, GGUF files, and LoRA weights) are intentionally excluded so the repository holds only code and config.

## Workflow

1. Download NIST PDFs into `data/raw/`
2. Extract structured text into `data/extracted/` (`src/extract_with_fallback.py` uses Docling first with MarkItDown fallback; `src/extract_single_pdf.py` handles single edge-case PDFs)
3. Build JSONL training splits in `data/training/` (`src/prepare_data_chunked.py` applies sentence-aware chunking and deduplicates JSON vs. Markdown by document stem)
4. Fine-tune a Qwen2.5-Coder model using MLX LoRA
5. Fuse the adapter, refresh tokenizer metadata, export GGUF, and load into Ollama (optional CMMC/HIPAA splits and local embeddings can branch from the extracted corpus)

## Excluded Artifacts

Not committed in git:
- raw PDFs
- extracted JSON/Markdown dumps
- training JSONL files or CMMC/HIPAA corpora
- generated embeddings, Parquet files, or FAISS indexes
- fused model weights, GGUF files, or LoRA checkpoints

## Quick Start

Start with a 2-doc sample:

```bash
make setup
make sample-download SAMPLE_DOCS=2
make extract
make prepare
```

Full pipeline:

```bash
make download
make extract
make prepare
make train
make deploy
```

If `llama.cpp` tools are outside `PATH`:

```bash
LLAMA_CPP_DIR=/path/to/llama.cpp make deploy
```

Run the Ollama smoke eval or full wrapper:

```bash
make eval
make pipeline
```

See [QUICKSTART.md](QUICKSTART.md) for step-by-step instructions.

## Repository Layout

- `src/`: data download, extraction, dataset prep, and MLX training modules
- `scripts/`: helper scripts for downloads, monitoring, evals, and local exports
- `config/`: training and Ollama Modelfile configuration (`config/training_config.yaml`)

## Defaults & Requirements

- Base model: `mlx-community/Qwen2.5-Coder-7B-Instruct-4bit` (`BASE_MODEL` overrides; update `MODELFILE_TEMPLATE` if switching model families)
- Fine-tuning: LoRA with MLX (`make setup-extensions` installs optional embedding/publish helpers)
- Ollama model name: `hackidle-nist-coder`
- Requires Apple Silicon Mac for MLX training, Python 3, disk space for PDFs/datasets, network access on first Docling run, and `ollama` + `llama.cpp` if exporting locally.

## Original Workspace Baseline

In the upstream working tree:
- `596` raw NIST PDFs (`data/raw/`)
- `596` extracted JSON files and `596` extracted Markdown files
- `530,912` training examples recorded in `training_v1.1_complete/data_stats.json`

## Published Artifacts

- Main dataset: [ethanolivertroy/nist-cybersecurity-training](https://huggingface.co/datasets/ethanolivertroy/nist-cybersecurity-training)
- Raw PDFs: [ethanolivertroy/nist-publications-raw](https://huggingface.co/datasets/ethanolivertroy/nist-publications-raw)
- CMMC splits: [core](https://huggingface.co/datasets/ethanolivertroy/cmmc-training-core), [balanced](https://huggingface.co/datasets/ethanolivertroy/cmmc-training-balanced), [all checks](https://huggingface.co/datasets/ethanolivertroy/cmmc-training-comprehensive)
- HIPAA dataset: [ethanolivertroy/hipaa-compliance-training](https://huggingface.co/datasets/ethanolivertroy/hipaa-compliance-training)
- Ollama model: [etgohome/hackidle-nist-coder](https://ollama.com/etgohome/hackidle-nist-coder)
- Hugging Face models: [MLX 4-bit](https://huggingface.co/ethanolivertroy/HackIDLE-NIST-Coder-MLX-4bit), [GGUF](https://huggingface.co/ethanolivertroy/HackIDLE-NIST-Coder-GGUF), [v1.1 MLX 4-bit](https://huggingface.co/ethanolivertroy/HackIDLE-NIST-Coder-v1.1-MLX-4bit), [v1.1 GGUF](https://huggingface.co/ethanolivertroy/HackIDLE-NIST-Coder-v1.1-GGUF)
- Archived source repo: [hackIDLE/nist-cybersecurity-mlx-pipeline](https://github.com/hackIDLE/nist-cybersecurity-mlx-pipeline)
