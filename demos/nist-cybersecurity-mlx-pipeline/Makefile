SHELL := /bin/bash

VENV_DIR ?= .venv
BASE_MODEL ?= mlx-community/Qwen2.5-Coder-7B-Instruct-4bit
MODEL_NAME ?= hackidle-nist-coder
SAMPLE_DOCS ?= 8
EXPECTED_PDFS ?= 596
CHUNK_SIZE ?= 2000

.PHONY: setup setup-extensions sample-download download extract retry-extract prepare train deploy eval monitor pipeline cmmc-lists cmmc-copy cmmc-core cmmc-balanced cmmc-comprehensive hipaa-download-core hipaa-download-cfr hipaa-download-ocr hipaa-download-fda hipaa-extract hipaa-extract-v11 hipaa-prepare embeddings

setup:
	python3 -m venv $(VENV_DIR)
	. $(VENV_DIR)/bin/activate && pip install --upgrade pip && pip install -r requirements.txt

setup-extensions:
	. $(VENV_DIR)/bin/activate && pip install -r requirements-extensions.txt

sample-download:
	. $(VENV_DIR)/bin/activate && python src/download_samples.py --output data/raw --max $(SAMPLE_DOCS)

download:
	. $(VENV_DIR)/bin/activate && python src/download_all_nist.py --output data/raw

extract:
	. $(VENV_DIR)/bin/activate && python src/extract_with_fallback.py --input data/raw --output data/extracted --format both

retry-extract:
	./scripts/extract_failed.sh

prepare:
	. $(VENV_DIR)/bin/activate && python src/prepare_data_chunked.py --input data/extracted --output data/training --split 0.8 --chunk-size $(CHUNK_SIZE)

train:
	. $(VENV_DIR)/bin/activate && python src/train.py --config config/training_config.yaml --run

deploy:
	MODEL_NAME=$(MODEL_NAME) BASE_MODEL=$(BASE_MODEL) ./scripts/deploy_to_ollama.sh

eval:
	. $(VENV_DIR)/bin/activate && python scripts/eval_ollama.py --model $(MODEL_NAME)

monitor:
	EXPECTED_PDFS=$(EXPECTED_PDFS) ./scripts/monitor_progress.sh

pipeline:
	BASE_MODEL=$(BASE_MODEL) EXPECTED_PDFS=$(EXPECTED_PDFS) ./scripts/run_full_pipeline.sh

cmmc-lists:
	. $(VENV_DIR)/bin/activate && python scripts/create_cmmc_document_lists.py

cmmc-copy:
	. $(VENV_DIR)/bin/activate && python scripts/copy_cmmc_extracted_files.py

cmmc-core:
	. $(VENV_DIR)/bin/activate && python src/prepare_cmmc_data.py --input data/cmmc/core/extracted --output data/cmmc/core/training --variant core

cmmc-balanced:
	. $(VENV_DIR)/bin/activate && python src/prepare_cmmc_data.py --input data/cmmc/balanced/extracted --output data/cmmc/balanced/training --variant balanced

cmmc-comprehensive:
	. $(VENV_DIR)/bin/activate && python src/prepare_cmmc_data.py --input data/cmmc/comprehensive/extracted --output data/cmmc/comprehensive/training --variant comprehensive

hipaa-download-core:
	. $(VENV_DIR)/bin/activate && python scripts/download_hipaa_docs.py --output data/hipaa/raw

hipaa-download-cfr:
	. $(VENV_DIR)/bin/activate && python scripts/download_cfr_html.py --output data/hipaa/raw/cfr

hipaa-download-ocr:
	. $(VENV_DIR)/bin/activate && python scripts/download_ocr_guidance.py --output data/hipaa/raw/ocr_guidance

hipaa-download-fda:
	. $(VENV_DIR)/bin/activate && python scripts/download_fda_guidance.py --output data/hipaa/raw/fda_guidance

hipaa-extract:
	. $(VENV_DIR)/bin/activate && python src/extract_with_fallback.py --input data/hipaa/raw --output data/hipaa/extracted --format both

hipaa-extract-v11:
	. $(VENV_DIR)/bin/activate && python scripts/extract_hipaa_v11_docs.py

hipaa-prepare:
	. $(VENV_DIR)/bin/activate && python src/prepare_hipaa_data.py --input data/hipaa/extracted --output data/hipaa/training

embeddings:
	. $(VENV_DIR)/bin/activate && python scripts/generate_embeddings.py --input-dir data/training --output-dir data/embeddings
