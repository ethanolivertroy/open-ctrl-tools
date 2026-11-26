#!/usr/bin/env python3
"""
Training Data Preparation with Smart Chunking

Converts extracted NIST documents into JSONL format with proper chunking.
Uses semantic chunking to respect sentence boundaries and context windows.
"""

import argparse
import json
import logging
import re
from pathlib import Path
from typing import List, Dict
import jsonlines
from tqdm import tqdm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SmartChunker:
    """Smart text chunking that respects sentence boundaries."""

    def __init__(self, max_chunk_size: int = 2000, overlap: int = 200):
        """
        Initialize chunker.

        Args:
            max_chunk_size: Maximum characters per chunk
            overlap: Characters to overlap between chunks for context
        """
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, heading: str = "") -> List[str]:
        """
        Chunk text intelligently by sentences.

        Args:
            text: Text to chunk
            heading: Optional heading to prepend to chunks

        Returns:
            List of text chunks
        """
        if len(text) <= self.max_chunk_size:
            return [text]

        # Split into sentences (basic approach)
        sentences = re.split(r'(?<=[.!?])\s+', text)

        chunks = []
        current_chunk = heading + "\n\n" if heading else ""

        for sentence in sentences:
            # If single sentence is too long, split by words
            if len(sentence) > self.max_chunk_size:
                words = sentence.split()
                for i in range(0, len(words), self.max_chunk_size // 10):
                    word_chunk = ' '.join(words[i:i + self.max_chunk_size // 10])
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                        current_chunk = ""
                    chunks.append(word_chunk)
                continue

            # Check if adding sentence exceeds limit
            if len(current_chunk) + len(sentence) > self.max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    # Start new chunk with overlap
                    overlap_text = current_chunk[-self.overlap:] if len(current_chunk) > self.overlap else current_chunk
                    current_chunk = overlap_text + "\n" + sentence
                else:
                    current_chunk = sentence
            else:
                current_chunk += " " + sentence

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks


class TrainingDataGenerator:
    """Generate training data with proper chunking."""

    def __init__(self, system_prompt: str = None, max_chunk_size: int = 2000):
        """
        Initialize generator.

        Args:
            system_prompt: System prompt for the model
            max_chunk_size: Maximum size for text chunks
        """
        self.system_prompt = system_prompt or (
            "You are a NIST-focused cybersecurity assistant trained on public NIST "
            "cybersecurity publications. Use the corpus to help people find likely "
            "documents, control families, implementation considerations, and draft "
            "explanations. When a user needs exact control language, exact framework "
            "step ordering, or exact reference-architecture component names, tell them "
            "to verify the answer against the source publication."
        )
        self.chunker = SmartChunker(max_chunk_size=max_chunk_size)

    def load_extracted_document(self, file_path: Path) -> Dict:
        """Load an extracted document."""
        if file_path.suffix == '.json':
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        elif file_path.suffix == '.md':
            return {
                'title': file_path.stem,
                'markdown': file_path.read_text(encoding='utf-8')
            }
        return None

    def select_source_files(self, input_dir: Path) -> List[Path]:
        """
        Select one canonical extracted file per document stem.

        Prefer JSON over Markdown when both exist so we do not generate
        duplicate training examples from the same extracted document.
        """
        selected: Dict[str, Path] = {}

        for file_path in sorted(input_dir.iterdir()):
            if file_path.suffix not in {'.json', '.md'}:
                continue
            if file_path.name.startswith('extraction_'):
                continue

            existing = selected.get(file_path.stem)
            if existing is None:
                selected[file_path.stem] = file_path
                continue

            if file_path.suffix == '.json' and existing.suffix != '.json':
                selected[file_path.stem] = file_path

        return list(selected.values())

    def extract_qa_pairs(self, doc: Dict) -> List[Dict]:
        """Extract Q&A pairs with proper chunking."""
        qa_pairs = []
        doc_title = doc.get('title', 'NIST Document')

        markdown = doc.get('markdown', '')
        if not markdown:
            return qa_pairs

        # Strategy 1: Section-based Q&A with chunking
        sections = self._parse_sections(markdown)
        for section in sections:
            if section['content'].strip():
                qa_pairs.extend(self._generate_section_qa_chunked(section, doc_title))

        # Strategy 2: Control-based Q&A (these are usually short)
        controls = self._extract_controls(markdown, doc_title)
        qa_pairs.extend(controls)

        # Strategy 3: Table-based Q&A
        if 'tables' in doc and doc['tables']:
            qa_pairs.extend(self._generate_table_qa(doc['tables'], doc_title))

        # Strategy 4: Definition-based Q&A
        definitions = self._extract_definitions(markdown, doc_title)
        qa_pairs.extend(definitions)

        # Strategy 5: Full-text semantic chunks for comprehensive coverage
        qa_pairs.extend(self._generate_semantic_chunks(markdown, doc_title))

        return qa_pairs

    def _parse_sections(self, markdown: str) -> List[Dict]:
        """Parse markdown into sections."""
        sections = []
        current_section = None

        for line in markdown.split('\n'):
            if line.startswith('#'):
                if current_section:
                    sections.append(current_section)

                heading_match = re.match(r'^(#+)\s+(.+)$', line)
                if heading_match:
                    level = len(heading_match.group(1))
                    title = heading_match.group(2).strip()
                    current_section = {
                        'level': level,
                        'title': title,
                        'content': ''
                    }
            elif current_section:
                current_section['content'] += line + '\n'

        if current_section:
            sections.append(current_section)

        return sections

    def _generate_section_qa_chunked(self, section: Dict, doc_title: str) -> List[Dict]:
        """Generate Q&A pairs from a section with chunking."""
        qa_pairs = []
        title = section['title']
        content = section['content'].strip()

        if not content or len(content) < 50:
            return qa_pairs

        # Chunk the content if it's long
        chunks = self.chunker.chunk_text(content, heading=title)

        for i, chunk in enumerate(chunks):
            # Generate questions for each chunk
            if len(chunks) == 1:
                questions = [
                    f"What does {doc_title} say about {title}?",
                    f"Explain {title} according to NIST {doc_title}",
                ]
            else:
                questions = [
                    f"What does {doc_title} say about {title}? (Part {i+1})",
                ]

            for question in questions:
                qa_pairs.append({
                    'question': question,
                    'answer': f"According to {doc_title}, {title}:\n\n{chunk}",
                    'source': doc_title,
                    'type': 'section',
                    'chunk_id': i
                })

        return qa_pairs

    def _generate_semantic_chunks(self, markdown: str, doc_title: str) -> List[Dict]:
        """Generate Q&A from semantic chunks of the full document."""
        qa_pairs = []

        # Remove headings for continuous text
        text = re.sub(r'^#+\s+.+$', '', markdown, flags=re.MULTILINE)
        text = text.strip()

        if len(text) < 100:
            return qa_pairs

        # Chunk the text
        chunks = self.chunker.chunk_text(text)

        for i, chunk in enumerate(chunks):
            # Only create QA for substantial chunks
            if len(chunk) > 200:
                qa_pairs.append({
                    'question': f"What information does {doc_title} provide? (Section {i+1})",
                    'answer': chunk,
                    'source': doc_title,
                    'type': 'semantic_chunk',
                    'chunk_id': i
                })

        return qa_pairs

    def _extract_controls(self, markdown: str, doc_title: str) -> List[Dict]:
        """Extract control-based Q&A pairs."""
        qa_pairs = []

        control_pattern = r'([A-Z]{2}-\d+(?:\(\d+\))?)[:\s]+(.*?)(?=\n[A-Z]{2}-\d+|$)'
        matches = re.finditer(control_pattern, markdown, re.DOTALL)

        for match in matches:
            control_id = match.group(1)
            control_text = match.group(2).strip()

            if not control_text or len(control_text) < 20:
                continue

            # Chunk long controls
            if len(control_text) > 2000:
                chunks = self.chunker.chunk_text(control_text)
                for i, chunk in enumerate(chunks):
                    qa_pairs.append({
                        'question': f"What is control {control_id} in {doc_title}? (Part {i+1})",
                        'answer': f"Control {control_id}: {chunk}",
                        'source': doc_title,
                        'type': 'control',
                        'chunk_id': i
                    })
            else:
                qa_pairs.append({
                    'question': f"What is control {control_id} in {doc_title}?",
                    'answer': f"Control {control_id}: {control_text}",
                    'source': doc_title,
                    'type': 'control'
                })

        return qa_pairs

    def _extract_definitions(self, markdown: str, doc_title: str) -> List[Dict]:
        """Extract definition-based Q&A pairs."""
        qa_pairs = []

        lines = markdown.split('\n')
        for line in lines:
            def_match = re.match(r'\*?\*?([A-Za-z][A-Za-z\s]+?)[\*\s]*:(.+)', line)
            if def_match and len(def_match.group(2).strip()) > 20:
                term = def_match.group(1).strip()
                definition = def_match.group(2).strip()

                qa_pairs.append({
                    'question': f"What is {term} according to {doc_title}?",
                    'answer': f"{term}: {definition}",
                    'source': doc_title,
                    'type': 'definition'
                })

        return qa_pairs

    def _generate_table_qa(self, tables: List[Dict], doc_title: str) -> List[Dict]:
        """Generate Q&A pairs from tables."""
        qa_pairs = []

        for i, table in enumerate(tables):
            caption = table.get('caption', f'Table {i+1}')
            if caption:
                qa_pairs.append({
                    'question': f"What information is in the table about {caption} in {doc_title}?",
                    'answer': f"The table in {doc_title} shows: {caption}",
                    'source': doc_title,
                    'type': 'table'
                })

        return qa_pairs

    def format_as_jsonl(self, qa_pairs: List[Dict]) -> List[Dict]:
        """Format Q&A pairs as JSONL training examples."""
        training_examples = []

        for qa in qa_pairs:
            example = {
                "messages": [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": qa['question']},
                    {"role": "assistant", "content": qa['answer']}
                ],
                "metadata": {
                    "source": qa.get('source'),
                    "type": qa.get('type'),
                    "chunk_id": qa.get('chunk_id')
                }
            }
            training_examples.append(example)

        return training_examples

    def process_directory(self, input_dir: Path, output_dir: Path, train_split: float = 0.8):
        """Process all extracted documents and create training datasets."""
        output_dir.mkdir(parents=True, exist_ok=True)

        all_files = self.select_source_files(input_dir)

        logger.info(
            "Found %s unique extracted documents (JSON preferred over Markdown)",
            len(all_files),
        )

        if not all_files:
            logger.warning(f"No extracted documents found in {input_dir}")
            return

        all_training_examples = []

        for file_path in tqdm(all_files, desc="Generating training data"):
            doc = self.load_extracted_document(file_path)
            if not doc:
                continue

            qa_pairs = self.extract_qa_pairs(doc)
            training_examples = self.format_as_jsonl(qa_pairs)
            all_training_examples.extend(training_examples)

        logger.info(f"Generated {len(all_training_examples)} training examples")

        # Shuffle and split
        import random
        random.seed(42)
        random.shuffle(all_training_examples)

        split_idx = int(len(all_training_examples) * train_split)
        train_data = all_training_examples[:split_idx]
        val_data = all_training_examples[split_idx:]

        # Save
        train_path = output_dir / 'train.jsonl'
        with jsonlines.open(train_path, 'w') as writer:
            writer.write_all(train_data)

        val_path = output_dir / 'valid.jsonl'
        with jsonlines.open(val_path, 'w') as writer:
            writer.write_all(val_data)

        logger.info(f"Training data: {len(train_data)} examples -> {train_path}")
        logger.info(f"Validation data: {len(val_data)} examples -> {val_path}")

        # Statistics
        stats = {
            'total_examples': len(all_training_examples),
            'train_examples': len(train_data),
            'validation_examples': len(val_data),
            'train_split': train_split,
            'source_documents': len(all_files),
            'chunking_enabled': True,
            'max_chunk_size': self.chunker.max_chunk_size,
        }

        stats_path = output_dir / 'data_stats.json'
        with open(stats_path, 'w') as f:
            json.dump(stats, f, indent=2)

        logger.info(f"Statistics saved to: {stats_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Prepare training data with smart chunking'
    )
    parser.add_argument('--input', '-i', default='data/extracted',
                        help='Input directory with extracted documents')
    parser.add_argument('--output', '-o', default='data/training',
                        help='Output directory for JSONL files')
    parser.add_argument('--split', type=float, default=0.8,
                        help='Training data split ratio')
    parser.add_argument('--chunk-size', type=int, default=2000,
                        help='Maximum chunk size in characters')

    args = parser.parse_args()

    input_dir = Path(args.input)
    output_dir = Path(args.output)

    if not input_dir.exists():
        logger.error(f"Input directory does not exist: {input_dir}")
        return

    generator = TrainingDataGenerator(max_chunk_size=args.chunk_size)
    generator.process_directory(input_dir, output_dir, train_split=args.split)


if __name__ == '__main__':
    main()
