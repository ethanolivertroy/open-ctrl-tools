#!/usr/bin/env python3
"""
HIPAA Compliance Training Data Preparation

Generates training data from HIPAA documents with:
- CFR section extraction (§164.308, §164.310, §164.312 format)
- Safeguard classification (Administrative, Physical, Technical)
- Implementation specification detection (Required vs Addressable)
- Entity type context (Covered Entity vs Business Associate)
- Breach notification thresholds
- Smart chunking with sentence boundaries
"""

import argparse
import json
import logging
import re
from pathlib import Path
from typing import List, Dict, Set, Tuple
import jsonlines
from tqdm import tqdm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# HIPAA Safeguard Types
SAFEGUARD_TYPES = {
    "administrative": [
        "§164.308", "administrative safeguard", "security management",
        "workforce security", "information access management", "security awareness",
        "security incident procedures", "contingency plan", "evaluation",
        "business associate", "written contract"
    ],
    "physical": [
        "§164.310", "physical safeguard", "facility access", "workstation use",
        "workstation security", "device and media controls", "disposal",
        "media re-use", "accountability", "data backup"
    ],
    "technical": [
        "§164.312", "technical safeguard", "access control", "audit controls",
        "integrity", "person or entity authentication", "transmission security",
        "encryption", "decryption", "automatic logoff", "unique user identification"
    ]
}

# Implementation Specification Keywords
IMPLEMENTATION_SPEC_KEYWORDS = {
    "required": ["required", "(R)", "shall", "must implement"],
    "addressable": ["addressable", "(A)", "may implement", "reasonable and appropriate"]
}

# Entity Type Keywords
ENTITY_TYPE_KEYWORDS = {
    "covered_entity": [
        "covered entity", "health plan", "health care clearinghouse",
        "health care provider", "provider", "plan"
    ],
    "business_associate": [
        "business associate", "BA", "subcontractor", "business associate agreement",
        "BAA", "services on behalf of"
    ]
}

# Breach Notification Keywords
BREACH_KEYWORDS = [
    "breach", "breach notification", "§164.40", "unauthorized acquisition",
    "500 or more", "fewer than 500", "risk assessment", "harm analysis",
    "media notice", "HHS", "individual notice"
]

# CFR Section Pattern (§164.308(a)(1)(i) format)
CFR_SECTION_PATTERN = re.compile(
    r'§\s*164\.(\d+)'  # Base section
    r'(?:\(([a-z])\))?'  # Optional subsection (a)
    r'(?:\((\d+)\))?'  # Optional paragraph (1)
    r'(?:\(([ivx]+)\))?'  # Optional subparagraph (i)
)

# NIST Control Pattern (for SP 800-66)
NIST_CONTROL_PATTERN = re.compile(r'\b[A-Z]{2}-\d+\b')  # AC-1, SI-7, etc.


class SmartChunker:
    """Smart text chunking that respects sentence boundaries."""

    def __init__(self, max_chunk_size: int = 2000, overlap: int = 200):
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap

    def chunk_text(self, text: str, heading: str = "") -> List[str]:
        """Chunk text intelligently by sentences."""
        if len(text) <= self.max_chunk_size:
            return [text]

        sentences = re.split(r'(?<=[.!?])\s+', text)
        chunks = []
        current_chunk = heading + "\n\n" if heading else ""

        for sentence in sentences:
            # Handle sentences longer than max_chunk_size
            if len(sentence) > self.max_chunk_size:
                words = sentence.split()
                for i in range(0, len(words), self.max_chunk_size // 10):
                    word_chunk = ' '.join(words[i:i + self.max_chunk_size // 10])
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                        current_chunk = ""
                    chunks.append(word_chunk)
                continue

            if len(current_chunk) + len(sentence) > self.max_chunk_size:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    # Add overlap
                    overlap_text = current_chunk[-self.overlap:] if len(current_chunk) > self.overlap else current_chunk
                    current_chunk = overlap_text + "\n" + sentence
                else:
                    current_chunk = sentence
            else:
                current_chunk += " " + sentence

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks


class HIPAAMetadataExtractor:
    """Extract HIPAA-specific metadata from documents."""

    def detect_document_type(self, filename: str, content: str) -> str:
        """Detect document type (regulation, preamble, guidance)."""
        filename_lower = filename.lower()

        if "45cfr" in filename_lower:
            return "regulation"
        elif any(x in filename_lower for x in ["nist", "sp-800", "sp_800"]):
            return "guidance"
        elif any(x in filename_lower for x in ["fda", "premarket", "postmarket"]):
            return "guidance"
        elif any(x in content[:2000].lower() for x in ["federal register", "preamble", "final rule"]):
            return "preamble"
        else:
            return "unknown"

    def detect_safeguard_types(self, content: str) -> Set[str]:
        """Detect which safeguard types are discussed."""
        safeguards = set()
        content_lower = content.lower()

        for safeguard_type, keywords in SAFEGUARD_TYPES.items():
            if any(kw.lower() in content_lower for kw in keywords):
                safeguards.add(safeguard_type)

        return safeguards if safeguards else {"unknown"}

    def detect_implementation_spec(self, content: str) -> str:
        """Detect if content discusses required vs addressable specs."""
        content_lower = content.lower()

        required_count = sum(1 for kw in IMPLEMENTATION_SPEC_KEYWORDS["required"]
                            if kw in content_lower)
        addressable_count = sum(1 for kw in IMPLEMENTATION_SPEC_KEYWORDS["addressable"]
                               if kw in content_lower)

        if required_count > addressable_count:
            return "required"
        elif addressable_count > required_count:
            return "addressable"
        else:
            return "both"

    def detect_entity_type(self, content: str) -> str:
        """Detect if content is specific to covered entities or business associates."""
        content_lower = content.lower()

        ce_count = sum(1 for kw in ENTITY_TYPE_KEYWORDS["covered_entity"]
                      if kw in content_lower)
        ba_count = sum(1 for kw in ENTITY_TYPE_KEYWORDS["business_associate"]
                      if kw in content_lower)

        if ce_count > ba_count * 2:
            return "covered_entity"
        elif ba_count > ce_count * 2:
            return "business_associate"
        else:
            return "both"

    def is_breach_related(self, content: str) -> bool:
        """Check if content discusses breach notification."""
        content_lower = content.lower()
        return any(kw in content_lower for kw in BREACH_KEYWORDS)

    def extract_cfr_sections(self, content: str) -> List[str]:
        """Extract CFR section references."""
        matches = CFR_SECTION_PATTERN.findall(content)
        sections = []

        for match in matches:
            section = f"§164.{match[0]}"
            if match[1]:  # Has subsection
                section += f"({match[1]})"
            if match[2]:  # Has paragraph
                section += f"({match[2]})"
            if match[3]:  # Has subparagraph
                section += f"({match[3]})"
            sections.append(section)

        return list(set(sections))[:20]  # Limit to prevent explosion

    def extract_nist_controls(self, content: str) -> List[str]:
        """Extract NIST control references (for SP 800-66)."""
        matches = NIST_CONTROL_PATTERN.findall(content)
        return list(set(matches))[:20]


class HIPAADataPreparation:
    """Main class for HIPAA training data preparation."""

    SYSTEM_PROMPT = """You are a HIPAA compliance expert with deep knowledge of the Security Rule, Privacy Rule, and Breach Notification Rule. You provide accurate, practical guidance on HIPAA requirements, implementation specifications, and compliance procedures. You cite specific CFR sections and distinguish between covered entity and business associate obligations."""

    def __init__(self, input_dir: str, output_dir: str, max_chunk_size: int = 2000):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.chunker = SmartChunker(max_chunk_size=max_chunk_size)
        self.metadata_extractor = HIPAAMetadataExtractor()

        self.stats = {
            "total_documents": 0,
            "total_examples": 0,
            "by_document_type": {},
            "by_safeguard_type": {},
            "by_implementation_spec": {},
            "by_entity_type": {},
            "breach_related": 0
        }

    def load_document(self, json_path: Path) -> Dict:
        """Load extracted document JSON."""
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def extract_qa_pairs(self, doc: Dict) -> List[Dict]:
        """Extract Q&A pairs using multiple strategies."""
        qa_pairs = []

        doc_title = doc.get("title", "Unknown Document")
        doc_content = doc.get("markdown", "") or doc.get("content", "")
        filename = doc.get("filename", "")

        if not doc_content or len(doc_content) < 100:
            return []

        # Extract metadata
        doc_type = self.metadata_extractor.detect_document_type(filename, doc_content)
        safeguard_types = self.metadata_extractor.detect_safeguard_types(doc_content)
        impl_spec = self.metadata_extractor.detect_implementation_spec(doc_content)
        entity_type = self.metadata_extractor.detect_entity_type(doc_content)
        is_breach = self.metadata_extractor.is_breach_related(doc_content)
        cfr_sections = self.metadata_extractor.extract_cfr_sections(doc_content)
        nist_controls = self.metadata_extractor.extract_nist_controls(doc_content)

        # Update stats
        self.stats["by_document_type"][doc_type] = self.stats["by_document_type"].get(doc_type, 0) + 1
        for safeguard in safeguard_types:
            self.stats["by_safeguard_type"][safeguard] = self.stats["by_safeguard_type"].get(safeguard, 0) + 1
        self.stats["by_implementation_spec"][impl_spec] = self.stats["by_implementation_spec"].get(impl_spec, 0) + 1
        self.stats["by_entity_type"][entity_type] = self.stats["by_entity_type"].get(entity_type, 0) + 1
        if is_breach:
            self.stats["breach_related"] += 1

        # Strategy 1: CFR Section-based Q&A
        if cfr_sections:
            qa_pairs.extend(self._extract_cfr_section_qa(
                doc, cfr_sections, safeguard_types, entity_type
            ))

        # Strategy 2: Safeguard-based Q&A
        qa_pairs.extend(self._extract_safeguard_qa(
            doc, safeguard_types, impl_spec, entity_type
        ))

        # Strategy 3: Implementation Specification Q&A
        qa_pairs.extend(self._extract_implementation_qa(
            doc, impl_spec, safeguard_types
        ))

        # Strategy 4: Entity Type Q&A
        qa_pairs.extend(self._extract_entity_type_qa(
            doc, entity_type, safeguard_types
        ))

        # Strategy 5: Breach Notification Q&A
        if is_breach:
            qa_pairs.extend(self._extract_breach_qa(doc))

        # Strategy 6: NIST Control Q&A (for SP 800-66)
        if nist_controls:
            qa_pairs.extend(self._extract_nist_control_qa(
                doc, nist_controls, safeguard_types
            ))

        # Strategy 7: Semantic Chunking (general content)
        qa_pairs.extend(self._extract_semantic_chunks(
            doc, safeguard_types, entity_type
        ))

        return qa_pairs

    def _extract_cfr_section_qa(
        self,
        doc: Dict,
        cfr_sections: List[str],
        safeguard_types: Set[str],
        entity_type: str
    ) -> List[Dict]:
        """Generate Q&A for specific CFR sections."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        for section in cfr_sections[:10]:  # Limit to 10 sections
            # Find context around this section
            pattern = re.compile(f'({re.escape(section)}[^§]{{100,800}})', re.IGNORECASE | re.DOTALL)
            matches = pattern.findall(doc_content)

            if matches:
                context = matches[0][:600]  # Limit context length

                question = f"What does {section} require?"

                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{context}",
                    "metadata": {
                        "source": doc_title,
                        "cfr_section": section,
                        "safeguard_types": list(safeguard_types),
                        "entity_type": entity_type,
                        "type": "cfr_section"
                    }
                })

        return qa_pairs

    def _extract_safeguard_qa(
        self,
        doc: Dict,
        safeguard_types: Set[str],
        impl_spec: str,
        entity_type: str
    ) -> List[Dict]:
        """Generate safeguard-focused Q&A."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        for safeguard in safeguard_types:
            if safeguard == "unknown":
                continue

            # Extract content about this safeguard
            chunks = self.chunker.chunk_text(doc_content[:3000])  # First 3000 chars

            if chunks:
                chunk = chunks[0]
                questions = [
                    f"What are the {safeguard} safeguards under HIPAA?",
                    f"How should organizations implement {safeguard} controls?",
                    f"What does HIPAA require for {safeguard} security?"
                ]

                for question in questions[:2]:  # Limit to 2 questions per safeguard
                    qa_pairs.append({
                        "question": question,
                        "answer": f"According to {doc_title}:\n\n{chunk}",
                        "metadata": {
                            "source": doc_title,
                            "safeguard_type": safeguard,
                            "implementation_spec": impl_spec,
                            "entity_type": entity_type,
                            "type": "safeguard"
                        }
                    })

        return qa_pairs

    def _extract_implementation_qa(
        self,
        doc: Dict,
        impl_spec: str,
        safeguard_types: Set[str]
    ) -> List[Dict]:
        """Generate Q&A about required vs addressable specifications."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        if impl_spec in ["required", "addressable", "both"]:
            chunks = self.chunker.chunk_text(doc_content[:2000])

            if chunks:
                chunk = chunks[0]
                questions = [
                    f"What's the difference between required and addressable implementation specifications?",
                    f"How do I determine if an addressable specification must be implemented?",
                    f"What are the required HIPAA security measures?"
                ]

                question = questions[0] if impl_spec == "both" else questions[1] if impl_spec == "addressable" else questions[2]

                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{chunk}",
                    "metadata": {
                        "source": doc_title,
                        "implementation_spec": impl_spec,
                        "safeguard_types": list(safeguard_types),
                        "type": "implementation"
                    }
                })

        return qa_pairs

    def _extract_entity_type_qa(
        self,
        doc: Dict,
        entity_type: str,
        safeguard_types: Set[str]
    ) -> List[Dict]:
        """Generate Q&A distinguishing covered entities vs business associates."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        if entity_type in ["covered_entity", "business_associate", "both"]:
            chunks = self.chunker.chunk_text(doc_content[:2500])

            if chunks:
                chunk = chunks[0]

                if entity_type == "both":
                    question = "What are the differences between covered entity and business associate obligations under HIPAA?"
                elif entity_type == "business_associate":
                    question = "What are business associate obligations under HIPAA?"
                else:
                    question = "What are covered entity obligations under HIPAA?"

                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{chunk}",
                    "metadata": {
                        "source": doc_title,
                        "entity_type": entity_type,
                        "safeguard_types": list(safeguard_types),
                        "type": "entity_obligations"
                    }
                })

        return qa_pairs

    def _extract_breach_qa(self, doc: Dict) -> List[Dict]:
        """Generate Q&A about breach notification."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        chunks = self.chunker.chunk_text(doc_content[:3000])

        breach_questions = [
            "When must a HIPAA breach be reported to HHS?",
            "What is considered a breach under HIPAA?",
            "How do I conduct a breach risk assessment?",
            "What are the notification requirements for breaches affecting 500 or more individuals?",
            "What is the timeline for breach notification under HIPAA?"
        ]

        for idx, chunk in enumerate(chunks[:3]):  # Limit to 3 chunks
            if idx < len(breach_questions):
                qa_pairs.append({
                    "question": breach_questions[idx],
                    "answer": f"According to {doc_title}:\n\n{chunk}",
                    "metadata": {
                        "source": doc_title,
                        "type": "breach_notification",
                        "cfr_section": "§164.400-414"
                    }
                })

        return qa_pairs

    def _extract_nist_control_qa(
        self,
        doc: Dict,
        nist_controls: List[str],
        safeguard_types: Set[str]
    ) -> List[Dict]:
        """Generate Q&A for NIST controls (SP 800-66)."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        for control in nist_controls[:10]:  # Limit to 10 controls
            # Find context around control
            pattern = re.compile(f'({re.escape(control)}[^A-Z]{{100,500}})', re.IGNORECASE | re.DOTALL)
            matches = pattern.findall(doc_content)

            if matches:
                context = matches[0][:400]

                question = f"How does NIST SP 800-66 recommend implementing control {control} for HIPAA?"

                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{context}",
                    "metadata": {
                        "source": doc_title,
                        "nist_control": control,
                        "safeguard_types": list(safeguard_types),
                        "type": "nist_implementation"
                    }
                })

        return qa_pairs

    def _extract_semantic_chunks(
        self,
        doc: Dict,
        safeguard_types: Set[str],
        entity_type: str
    ) -> List[Dict]:
        """Extract general content via semantic chunking."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        # Chunk the document
        chunks = self.chunker.chunk_text(doc_content)

        # Create Q&A for select chunks (not all to avoid data explosion)
        for idx, chunk in enumerate(chunks[::3]):  # Every 3rd chunk
            if len(chunk) < 200:  # Skip short chunks
                continue

            # Generate generic question
            question = f"What does {doc_title} say about HIPAA compliance?"
            if idx > 0:
                question += f" (Part {idx + 1})"

            qa_pairs.append({
                "question": question,
                "answer": f"According to {doc_title}:\n\n{chunk}",
                "metadata": {
                    "source": doc_title,
                    "safeguard_types": list(safeguard_types),
                    "entity_type": entity_type,
                    "type": "semantic_chunk",
                    "chunk_id": idx
                }
            })

        return qa_pairs

    def create_training_example(self, qa_pair: Dict) -> Dict:
        """Create chat-formatted training example."""
        return {
            "messages": [
                {
                    "role": "system",
                    "content": self.SYSTEM_PROMPT
                },
                {
                    "role": "user",
                    "content": qa_pair["question"]
                },
                {
                    "role": "assistant",
                    "content": qa_pair["answer"]
                }
            ],
            "metadata": qa_pair["metadata"]
        }

    def process_documents(self) -> Tuple[List[Dict], List[Dict]]:
        """Process all documents and create train/valid splits."""
        all_examples = []

        # Use rglob to find JSON files recursively (includes subdirectories)
        json_files = sorted(self.input_dir.rglob("*.json"))

        if not json_files:
            logger.error(f"No JSON files found in {self.input_dir}")
            return [], []

        logger.info(f"Processing {len(json_files)} documents...")
        self.stats["total_documents"] = len(json_files)

        for json_path in tqdm(json_files, desc="Processing documents"):
            try:
                doc = self.load_document(json_path)
                qa_pairs = self.extract_qa_pairs(doc)

                for qa_pair in qa_pairs:
                    example = self.create_training_example(qa_pair)
                    all_examples.append(example)

            except Exception as e:
                logger.error(f"Error processing {json_path.name}: {e}")
                continue

        self.stats["total_examples"] = len(all_examples)

        # Create 80/20 train/valid split
        import random
        random.seed(42)
        random.shuffle(all_examples)

        split_idx = int(len(all_examples) * 0.8)
        train_examples = all_examples[:split_idx]
        valid_examples = all_examples[split_idx:]

        logger.info(f"Generated {len(all_examples)} total examples")
        logger.info(f"  Train: {len(train_examples)}")
        logger.info(f"  Valid: {len(valid_examples)}")

        return train_examples, valid_examples

    def save_dataset(self, train_examples: List[Dict], valid_examples: List[Dict]):
        """Save train/valid datasets as JSONL."""
        train_path = self.output_dir / "train.jsonl"
        valid_path = self.output_dir / "valid.jsonl"

        logger.info(f"Saving training data to {train_path}")
        with jsonlines.open(train_path, mode='w') as writer:
            for example in train_examples:
                writer.write(example)

        logger.info(f"Saving validation data to {valid_path}")
        with jsonlines.open(valid_path, mode='w') as writer:
            for example in valid_examples:
                writer.write(example)

        # Save statistics
        stats_path = self.output_dir / "stats.json"
        with open(stats_path, 'w') as f:
            json.dump(self.stats, f, indent=2)
        logger.info(f"Saved statistics to {stats_path}")

    def run(self):
        """Run the full data preparation pipeline."""
        logger.info("Starting HIPAA data preparation...")

        train_examples, valid_examples = self.process_documents()

        if not train_examples:
            logger.error("No training examples generated!")
            return

        self.save_dataset(train_examples, valid_examples)

        logger.info("\n" + "="*60)
        logger.info("DATA PREPARATION COMPLETE")
        logger.info("="*60)
        logger.info(f"Documents processed: {self.stats['total_documents']}")
        logger.info(f"Total examples: {self.stats['total_examples']}")
        logger.info(f"  Train: {len(train_examples)}")
        logger.info(f"  Valid: {len(valid_examples)}")
        logger.info(f"\nBy document type:")
        for doc_type, count in self.stats['by_document_type'].items():
            logger.info(f"  {doc_type}: {count}")
        logger.info(f"\nBy safeguard type:")
        for safeguard, count in self.stats['by_safeguard_type'].items():
            logger.info(f"  {safeguard}: {count}")
        logger.info(f"\nBreachrelated: {self.stats['breach_related']}")
        logger.info("="*60)


def main():
    parser = argparse.ArgumentParser(
        description="Prepare HIPAA compliance training data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic usage
  python src/prepare_hipaa_data.py \\
      --input data/hipaa/extracted \\
      --output data/hipaa/training

  # With custom chunk size
  python src/prepare_hipaa_data.py \\
      --input data/hipaa/extracted \\
      --output data/hipaa/training \\
      --chunk-size 2500
"""
    )

    parser.add_argument(
        "--input",
        type=str,
        required=True,
        help="Input directory with extracted JSON files"
    )

    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output directory for training data"
    )

    parser.add_argument(
        "--chunk-size",
        type=int,
        default=2000,
        help="Maximum chunk size in characters (default: 2000)"
    )

    args = parser.parse_args()

    prep = HIPAADataPreparation(
        input_dir=args.input,
        output_dir=args.output,
        max_chunk_size=args.chunk_size
    )

    prep.run()


if __name__ == "__main__":
    main()
