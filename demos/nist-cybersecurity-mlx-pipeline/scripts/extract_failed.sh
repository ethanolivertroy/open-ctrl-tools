#!/bin/bash
# Extract documents that failed with Docling using MarkItDown fallback

set -e

echo "================================================"
echo "   Re-extract Failed Documents"
echo "================================================"
echo ""

activate_venv() {
    if [ -n "$VIRTUAL_ENV" ]; then
        return
    fi

    if [ -f ".venv/bin/activate" ]; then
        echo "Activating .venv..."
        # shellcheck disable=SC1091
        source .venv/bin/activate
        return
    fi

    if [ -f "venv/bin/activate" ]; then
        echo "Activating venv..."
        # shellcheck disable=SC1091
        source venv/bin/activate
    fi
}

activate_venv

# Count total PDFs and extracted files
TOTAL_PDFS=$(ls -1 data/raw/*.pdf 2>/dev/null | wc -l)
EXTRACTED=$(ls -1 data/extracted/*.json 2>/dev/null | wc -l)
FAILED=$((TOTAL_PDFS - EXTRACTED))

echo "Total PDFs: $TOTAL_PDFS"
echo "Extracted: $EXTRACTED"
echo "Failed/Missing: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ All documents extracted successfully!"
    exit 0
fi

echo "Identifying failed documents..."
echo ""

# Create temp directory for failed PDFs list
mkdir -p data/temp
FAILED_LIST="data/temp/failed_pdfs.txt"

# Find PDFs without corresponding JSON files
> "$FAILED_LIST"
for pdf in data/raw/*.pdf; do
    basename=$(basename "$pdf" .pdf)
    json_file="data/extracted/${basename}.json"
    if [ ! -f "$json_file" ]; then
        echo "$pdf" >> "$FAILED_LIST"
    fi
done

FAILED_COUNT=$(wc -l < "$FAILED_LIST")
echo "Found $FAILED_COUNT documents to re-extract:"
head -10 "$FAILED_LIST"
if [ $FAILED_COUNT -gt 10 ]; then
    echo "... and $(($FAILED_COUNT - 10)) more"
fi
echo ""

read -p "Re-extract these documents with MarkItDown fallback? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting hybrid extraction on failed documents..."
    echo ""

    # Create temp directory for failed PDFs
    TEMP_DIR="data/temp/failed_pdfs"
    mkdir -p "$TEMP_DIR"

    # Copy failed PDFs to temp directory
    while IFS= read -r pdf; do
        cp "$pdf" "$TEMP_DIR/"
    done < "$FAILED_LIST"

    # Run hybrid extraction on temp directory
    python src/extract_with_fallback.py \
        --input "$TEMP_DIR" \
        --output data/extracted \
        --format both \
        --timeout 120

    # Clean up
    rm -rf "$TEMP_DIR"
    rm -f "$FAILED_LIST"

    echo ""
    echo "✓ Re-extraction complete!"

    # Show final stats
    FINAL_EXTRACTED=$(ls -1 data/extracted/*.json 2>/dev/null | wc -l)
    FINAL_FAILED=$((TOTAL_PDFS - FINAL_EXTRACTED))

    echo ""
    echo "Final Statistics:"
    echo "  Total PDFs: $TOTAL_PDFS"
    echo "  Extracted: $FINAL_EXTRACTED"
    echo "  Still failed: $FINAL_FAILED"
    echo "  Success rate: $(echo "scale=1; $FINAL_EXTRACTED * 100 / $TOTAL_PDFS" | bc)%"
    echo ""

    if [ -f "data/extracted/extraction_report.json" ]; then
        echo "Detailed report: data/extracted/extraction_report.json"
    fi
else
    echo "Skipping re-extraction."
fi
