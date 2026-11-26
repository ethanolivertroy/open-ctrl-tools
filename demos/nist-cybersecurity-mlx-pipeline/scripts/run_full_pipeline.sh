#!/bin/bash
# Complete pipeline: Extract -> Prepare -> Train -> Deploy

set -e

echo "================================================"
echo "   NIST LLM Fine-Tuning - Full Pipeline"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

MODEL_NAME=${MODEL_NAME:-hackidle-nist-coder}
BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-Coder-7B-Instruct-4bit}
EXPECTED_PDFS=${EXPECTED_PDFS:-596}
DOCLING_TIMEOUT=${DOCLING_TIMEOUT:-120}

# Configuration
SKIP_EXTRACT=${SKIP_EXTRACT:-false}
SKIP_PREPARE=${SKIP_PREPARE:-false}
SKIP_TRAIN=${SKIP_TRAIN:-false}

activate_venv() {
    if [ -n "$VIRTUAL_ENV" ]; then
        return
    fi

    if [ -f ".venv/bin/activate" ]; then
        echo -e "${YELLOW}Activating .venv...${NC}"
        # shellcheck disable=SC1091
        source .venv/bin/activate
        return
    fi

    if [ -f "venv/bin/activate" ]; then
        echo -e "${YELLOW}Activating venv...${NC}"
        # shellcheck disable=SC1091
        source venv/bin/activate
    fi
}

activate_venv

mkdir -p data/raw data/extracted data/training models

# Check for downloaded PDFs
PDF_COUNT=$(ls -1 data/raw/*.pdf 2>/dev/null | wc -l)
echo -e "${BLUE}Found $PDF_COUNT PDFs in data/raw/${NC}"
echo ""

if [ $PDF_COUNT -eq 0 ]; then
    echo -e "${RED}No PDFs found! Run download first.${NC}"
    exit 1
fi

# ====================
# STEP 1: EXTRACT
# ====================
if [ "$SKIP_EXTRACT" != "true" ]; then
    echo -e "${BLUE}[1/4] Extracting content with Docling + MarkItDown fallback...${NC}"
    echo "This will take a while for a full run of roughly ${EXPECTED_PDFS} documents."
    echo ""

    python src/extract_with_fallback.py \
        --input data/raw \
        --output data/extracted \
        --format both \
        --timeout "$DOCLING_TIMEOUT"

    echo -e "${GREEN}✓ Extraction complete${NC}"
    echo ""
else
    echo -e "${YELLOW}[1/4] Skipping extraction (SKIP_EXTRACT=true)${NC}"
    echo ""
fi

# Check extracted files
EXTRACTED_COUNT=$(ls -1 data/extracted/*.json 2>/dev/null | wc -l)
echo "Extracted documents: $EXTRACTED_COUNT"
echo ""

# ====================
# STEP 2: PREPARE DATA
# ====================
if [ "$SKIP_PREPARE" != "true" ]; then
    echo -e "${BLUE}[2/4] Preparing training data with smart chunking...${NC}"
    echo ""

    python src/prepare_data_chunked.py \
        --input data/extracted \
        --output data/training \
        --split 0.8 \
        --chunk-size 2000

    echo -e "${GREEN}✓ Data preparation complete${NC}"
    echo ""
else
    echo -e "${YELLOW}[2/4] Skipping data preparation (SKIP_PREPARE=true)${NC}"
    echo ""
fi

# Show training data stats
if [ -f "data/training/data_stats.json" ]; then
    echo "Training data statistics:"
    cat data/training/data_stats.json | python -m json.tool
    echo ""
fi

# ====================
# STEP 3: FINE-TUNE
# ====================
if [ "$SKIP_TRAIN" != "true" ]; then
    echo -e "${BLUE}[3/4] Fine-tuning model with MLX...${NC}"
    echo ""
    echo "Configuration:"
    echo "  - Base model: $BASE_MODEL"
    echo "  - Method: LoRA (Low-Rank Adaptation)"
    echo "  - Training data: data/training/train.jsonl"
    echo "  - Config file: config/training_config.yaml"
    echo ""
    echo "This may take 30 minutes to several hours depending on model size and dataset volume."
    echo ""

    read -p "Start training? (y/n) " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting MLX fine-tuning..."
        echo ""

        python src/train.py --config config/training_config.yaml --run

        echo -e "${GREEN}✓ Training complete${NC}"
        echo ""
    else
        echo "Skipping training."
        echo "To train later, run:"
        echo "  python src/train.py --config config/training_config.yaml"
        exit 0
    fi
else
    echo -e "${YELLOW}[3/4] Skipping training (SKIP_TRAIN=true)${NC}"
    echo ""
fi

# ====================
# STEP 4: DEPLOY
# ====================
echo -e "${BLUE}[4/4] Deploying to Ollama...${NC}"
echo ""

read -p "Deploy to Ollama? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    MODEL_NAME="$MODEL_NAME" BASE_MODEL="$BASE_MODEL" ./scripts/deploy_to_ollama.sh

    echo -e "${GREEN}✓ Deployment complete${NC}"
    echo ""
else
    echo "Skipping deployment."
    echo "To deploy later, run:"
    echo "  ./scripts/deploy_to_ollama.sh"
    exit 0
fi

# ====================
# COMPLETE
# ====================
echo "================================================"
echo -e "${GREEN}Pipeline Complete!${NC}"
echo "================================================"
echo ""
echo "Your NIST-focused local model is ready."
echo ""
echo "Test it with:"
echo "  ollama run $MODEL_NAME \"What is Zero Trust Architecture?\""
echo ""
echo "Example queries in: examples/example_queries.md"
echo ""
