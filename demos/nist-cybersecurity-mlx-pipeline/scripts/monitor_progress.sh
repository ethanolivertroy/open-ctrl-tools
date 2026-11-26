#!/bin/bash
# Monitor pipeline progress

EXPECTED_PDFS=${EXPECTED_PDFS:-596}
MODEL_NAME=${MODEL_NAME:-hackidle-nist-coder}
ADAPTER_PATH=${ADAPTER_PATH:-models/hackidle-nist-coder-lora}
MERGED_PATH=${MERGED_PATH:-models/hackidle-nist-coder-merged}

echo "================================================"
echo "   NIST LLM Fine-Tuning - Progress Monitor"
echo "================================================"
echo ""

# Count files
PDF_COUNT=$(ls -1 data/raw/*.pdf 2>/dev/null | wc -l || echo "0")
EXTRACTED_JSON=$(ls -1 data/extracted/*.json 2>/dev/null | wc -l || echo "0")
EXTRACTED_MD=$(ls -1 data/extracted/*.md 2>/dev/null | wc -l || echo "0")

# Check training data
if [ -f "data/training/train.jsonl" ]; then
    TRAIN_EXAMPLES=$(wc -l < data/training/train.jsonl)
else
    TRAIN_EXAMPLES=0
fi

if [ -f "data/training/valid.jsonl" ]; then
    VAL_EXAMPLES=$(wc -l < data/training/valid.jsonl)
else
    VAL_EXAMPLES=0
fi

# Check model
if [ -d "$ADAPTER_PATH" ]; then
    MODEL_STATUS="✓ LoRA adapter exists"
else
    MODEL_STATUS="⏳ Not trained yet"
fi

if [ -d "$MERGED_PATH" ]; then
    MERGED_STATUS="✓ Merged model exists"
else
    MERGED_STATUS="⏳ Not merged yet"
fi

# Check Ollama
if ollama list 2>/dev/null | grep -q "$MODEL_NAME"; then
    OLLAMA_STATUS="✓ Deployed to Ollama"
else
    OLLAMA_STATUS="⏳ Not deployed yet"
fi

# Display status
echo "DOWNLOAD"
echo "  PDFs downloaded: $PDF_COUNT / $EXPECTED_PDFS"
if [ $PDF_COUNT -gt 0 ]; then
    PERCENT=$((PDF_COUNT * 100 / EXPECTED_PDFS))
    echo "  Progress: $PERCENT%"
fi
echo ""

echo "EXTRACTION"
echo "  JSON files: $EXTRACTED_JSON"
echo "  Markdown files: $EXTRACTED_MD"
if [ $EXTRACTED_JSON -gt 0 ]; then
    EXTRACT_PERCENT=$((EXTRACTED_JSON * 100 / PDF_COUNT))
    echo "  Progress: $EXTRACT_PERCENT% of downloaded PDFs"
fi
echo ""

echo "TRAINING DATA"
echo "  Training examples: $TRAIN_EXAMPLES"
echo "  Validation examples: $VAL_EXAMPLES"
echo "  Total: $((TRAIN_EXAMPLES + VAL_EXAMPLES))"
if [ -f "data/training/data_stats.json" ]; then
    echo "  Stats available: data/training/data_stats.json"
fi
echo ""

echo "MODEL"
echo "  $MODEL_STATUS"
echo "  $MERGED_STATUS"
echo ""

echo "DEPLOYMENT"
echo "  $OLLAMA_STATUS"
echo ""

# Data size
if [ -d "data/raw" ]; then
    RAW_SIZE=$(du -sh data/raw 2>/dev/null | cut -f1)
    echo "DISK USAGE"
    echo "  Raw PDFs: $RAW_SIZE"
    if [ -d "data/extracted" ]; then
        EXTRACTED_SIZE=$(du -sh data/extracted 2>/dev/null | cut -f1)
        echo "  Extracted: $EXTRACTED_SIZE"
    fi
    if [ -d "models" ]; then
        MODELS_SIZE=$(du -sh models 2>/dev/null | cut -f1)
        echo "  Models: $MODELS_SIZE"
    fi
    echo ""
fi

# Next steps
echo "NEXT STEPS"
if [ $PDF_COUNT -lt $EXPECTED_PDFS ]; then
    echo "  Wait for downloads to complete ($PDF_COUNT/$EXPECTED_PDFS)"
elif [ $EXTRACTED_JSON -lt $PDF_COUNT ]; then
    echo "  Run extraction: make extract"
elif [ $TRAIN_EXAMPLES -eq 0 ]; then
    echo "  Prepare training data: make prepare"
elif [ ! -d "$ADAPTER_PATH" ]; then
    echo "  Train model: make train"
elif [ ! -d "$MERGED_PATH" ]; then
    echo "  Merge and deploy: make deploy"
elif [[ $OLLAMA_STATUS == *"Not deployed"* ]]; then
    echo "  Deploy to Ollama: make deploy"
else
    echo "  All done. Test your model:"
    echo "    ollama run $MODEL_NAME \"What is Zero Trust?\""
fi
echo ""
