#!/bin/bash
# Deploy fine-tuned model to Ollama through a GGUF export.

set -euo pipefail

echo "=== NIST-focused model deployment ==="
echo ""

MODEL_NAME=${MODEL_NAME:-hackidle-nist-coder}
ADAPTER_PATH=${ADAPTER_PATH:-models/hackidle-nist-coder-lora}
MERGED_MODEL=${MERGED_MODEL:-models/hackidle-nist-coder-merged}
DEQUANTIZED_MODEL=${DEQUANTIZED_MODEL:-models/hackidle-nist-coder-dequantized}
GGUF_DIR=${GGUF_DIR:-models/gguf}
GGUF_F16_PATH=${GGUF_F16_PATH:-$GGUF_DIR/hackidle-nist-coder-f16.gguf}
GGUF_MODEL_PATH=${GGUF_MODEL_PATH:-$GGUF_DIR/hackidle-nist-coder-q4_k_m.gguf}
GGUF_QUANT=${GGUF_QUANT:-Q4_K_M}
BASE_MODEL=${BASE_MODEL:-mlx-community/Qwen2.5-Coder-7B-Instruct-4bit}
MODELFILE_TEMPLATE=${MODELFILE_TEMPLATE:-config/Modelfile}
LLAMA_CPP_DIR=${LLAMA_CPP_DIR:-}
GGUF_CONVERTER_PYTHON=${GGUF_CONVERTER_PYTHON:-}
ORIGINAL_PATH=$PATH

activate_venv() {
    if [ -n "${VIRTUAL_ENV:-}" ]; then
        return
    fi

    if [ -f ".venv/bin/activate" ]; then
        # shellcheck disable=SC1091
        source .venv/bin/activate
        return
    fi

    if [ -f "venv/bin/activate" ]; then
        # shellcheck disable=SC1091
        source venv/bin/activate
    fi
}

resolve_python() {
    if command -v python >/dev/null 2>&1; then
        echo "python"
        return
    fi

    if command -v python3 >/dev/null 2>&1; then
        echo "python3"
        return
    fi

    echo "Error: python or python3 is required" >&2
    exit 1
}

python_has_converter_deps() {
    local candidate="$1"

    "$candidate" - <<'PY' >/dev/null 2>&1
import gguf
import mistral_common
PY
}

resolve_converter_python() {
    local candidate=""

    if [ -n "$GGUF_CONVERTER_PYTHON" ]; then
        echo "$GGUF_CONVERTER_PYTHON"
        return
    fi

    candidate=$(PATH="$ORIGINAL_PATH" command -v python3 2>/dev/null || true)
    if [ -n "$candidate" ] && python_has_converter_deps "$candidate"; then
        echo "$candidate"
        return
    fi

    if python_has_converter_deps "$PYTHON_BIN"; then
        echo "$PYTHON_BIN"
        return
    fi

    echo "Error: Could not find a Python interpreter with llama.cpp converter dependencies." >&2
    echo "Set GGUF_CONVERTER_PYTHON to a Python that can import gguf and mistral_common." >&2
    exit 1
}

find_gguf_converter() {
    if [ -n "$LLAMA_CPP_DIR" ] && [ -f "$LLAMA_CPP_DIR/convert_hf_to_gguf.py" ]; then
        echo "$LLAMA_CPP_DIR/convert_hf_to_gguf.py"
        return
    fi

    if [ -f "./llama.cpp/convert_hf_to_gguf.py" ]; then
        echo "$(pwd)/llama.cpp/convert_hf_to_gguf.py"
        return
    fi

    if command -v convert_hf_to_gguf.py >/dev/null 2>&1; then
        command -v convert_hf_to_gguf.py
        return
    fi

    echo ""
}

find_quantizer() {
    if [ -n "$LLAMA_CPP_DIR" ] && [ -x "$LLAMA_CPP_DIR/build/bin/llama-quantize" ]; then
        echo "$LLAMA_CPP_DIR/build/bin/llama-quantize"
        return
    fi

    if [ -n "$LLAMA_CPP_DIR" ] && [ -x "$LLAMA_CPP_DIR/llama-quantize" ]; then
        echo "$LLAMA_CPP_DIR/llama-quantize"
        return
    fi

    if [ -x "./llama.cpp/build/bin/llama-quantize" ]; then
        echo "$(pwd)/llama.cpp/build/bin/llama-quantize"
        return
    fi

    if [ -x "./llama.cpp/llama-quantize" ]; then
        echo "$(pwd)/llama.cpp/llama-quantize"
        return
    fi

    if command -v llama-quantize >/dev/null 2>&1; then
        command -v llama-quantize
        return
    fi

    echo ""
}

refresh_tokenizer_metadata() {
    local model_dir="$1"

    "$PYTHON_BIN" - "$BASE_MODEL" "$model_dir" <<'PY'
from pathlib import Path
import shutil
import sys

from huggingface_hub import hf_hub_download

base_model = sys.argv[1]
model_dir = Path(sys.argv[2])

if Path(base_model).is_dir():
    source_dir = Path(base_model)

    tokenizer_config = source_dir / "tokenizer_config.json"
    if not tokenizer_config.exists():
        raise SystemExit(f"Missing tokenizer_config.json in local base model: {base_model}")

    shutil.copy2(tokenizer_config, model_dir / "tokenizer_config.json")

    chat_template = source_dir / "chat_template.jinja"
    if chat_template.exists():
        shutil.copy2(chat_template, model_dir / "chat_template.jinja")
else:
    tokenizer_config = Path(
        hf_hub_download(repo_id=base_model, filename="tokenizer_config.json")
    )
    shutil.copy2(tokenizer_config, model_dir / "tokenizer_config.json")

    try:
        chat_template = Path(
            hf_hub_download(repo_id=base_model, filename="chat_template.jinja")
        )
    except Exception:
        chat_template = None

    if chat_template and chat_template.exists():
        shutil.copy2(chat_template, model_dir / "chat_template.jinja")

print(f"Refreshed tokenizer metadata in {model_dir}")
PY
}

activate_venv
PYTHON_BIN=$(resolve_python)
GGUF_CONVERTER_PYTHON=$(resolve_converter_python)
GGUF_CONVERTER=$(find_gguf_converter)
GGUF_QUANTIZER=$(find_quantizer)

if ! command -v ollama >/dev/null 2>&1; then
    echo "Error: Ollama is not installed"
    echo "Install from: https://ollama.com"
    exit 1
fi

if [ -z "$GGUF_CONVERTER" ]; then
    echo "Error: convert_hf_to_gguf.py not found"
    echo "Install llama.cpp tools or set LLAMA_CPP_DIR to a local llama.cpp checkout."
    exit 1
fi

if [ -z "$GGUF_QUANTIZER" ]; then
    echo "Error: llama-quantize not found"
    echo "Install llama.cpp tools or set LLAMA_CPP_DIR to a local llama.cpp checkout."
    exit 1
fi

if [ ! -f "$MODELFILE_TEMPLATE" ]; then
    echo "Error: Modelfile template not found at $MODELFILE_TEMPLATE"
    exit 1
fi

echo "Step 1: Checking for fine-tuned model..."
if [ ! -d "$ADAPTER_PATH" ]; then
    echo "Error: Fine-tuned adapter not found at $ADAPTER_PATH"
    echo "Please run training first: python src/train.py --config config/training_config.yaml --run"
    exit 1
fi

echo "✓ Adapter found"

BASE_MODEL_LOWER=$(printf '%s' "$BASE_MODEL" | tr '[:upper:]' '[:lower:]')
if [ "$MODELFILE_TEMPLATE" = "config/Modelfile" ] && [[ "$BASE_MODEL_LOWER" != *qwen* ]]; then
    echo ""
    echo "Note: config/Modelfile matches the default Qwen2.5-Coder chat template."
    echo "If you switch to a Llama or Mistral family model, point MODELFILE_TEMPLATE at a matching template before release QA."
fi

echo ""
echo "Step 2: Fusing LoRA adapter into an MLX model..."
if [ ! -d "$MERGED_MODEL" ]; then
    echo "Creating merged MLX model at $MERGED_MODEL..."
    "$PYTHON_BIN" -m mlx_lm fuse \
        --model "$BASE_MODEL" \
        --adapter-path "$ADAPTER_PATH" \
        --save-path "$MERGED_MODEL"
fi

echo "✓ MLX model ready"

echo ""
echo "Step 3: Creating a dequantized export for GGUF conversion..."
if [ ! -d "$DEQUANTIZED_MODEL" ]; then
    echo "Creating dequantized model at $DEQUANTIZED_MODEL..."
    "$PYTHON_BIN" -m mlx_lm fuse \
        --model "$BASE_MODEL" \
        --adapter-path "$ADAPTER_PATH" \
        --save-path "$DEQUANTIZED_MODEL" \
        --dequantize
fi

echo "✓ Dequantized model ready"

echo ""
echo "Step 4: Refreshing tokenizer metadata from the base model..."
refresh_tokenizer_metadata "$DEQUANTIZED_MODEL"
echo "✓ Tokenizer metadata refreshed"

echo ""
echo "Step 5: Converting the dequantized model to GGUF F16..."
mkdir -p "$GGUF_DIR"
if [ ! -f "$GGUF_F16_PATH" ]; then
    "$GGUF_CONVERTER_PYTHON" "$GGUF_CONVERTER" \
        "$DEQUANTIZED_MODEL" \
        --outfile "$GGUF_F16_PATH" \
        --outtype f16
fi

echo "✓ GGUF F16 created"

echo ""
echo "Step 6: Quantizing GGUF for Ollama..."
if [ ! -f "$GGUF_MODEL_PATH" ]; then
    "$GGUF_QUANTIZER" \
        "$GGUF_F16_PATH" \
        "$GGUF_MODEL_PATH" \
        "$GGUF_QUANT"
fi

echo "✓ Quantized GGUF created"

echo ""
echo "Step 7: Creating Ollama model..."
MODEL_SOURCE="$GGUF_MODEL_PATH"
case "$MODEL_SOURCE" in
    /*) ;;
    *) MODEL_SOURCE="$(pwd)/$MODEL_SOURCE" ;;
esac

TEMP_MODELFILE=$(mktemp)
trap 'rm -f "$TEMP_MODELFILE"' EXIT
sed "s|^FROM .*|FROM $MODEL_SOURCE|" "$MODELFILE_TEMPLATE" > "$TEMP_MODELFILE"

ollama create "$MODEL_NAME" -f "$TEMP_MODELFILE"

echo ""
echo "✓ Model created successfully!"
echo ""
echo "You can now use the model with:"
echo "  ollama run $MODEL_NAME"
echo ""
echo "Example query:"
echo "  ollama run $MODEL_NAME \"What are the key components of Zero Trust Architecture?\""
