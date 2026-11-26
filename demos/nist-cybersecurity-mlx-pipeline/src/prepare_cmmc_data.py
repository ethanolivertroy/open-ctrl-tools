#!/usr/bin/env python3
"""
CMMC Training Data Preparation with Enhanced Metadata

Extends prepare_data_chunked.py with CMMC-specific features:
- CMMC level detection (Level 1/2/3)
- Domain mapping (17 CMMC domains)
- Control ID extraction (NIST ↔ CMMC mapping)
- CMMC-specific Q&A generation
- Weighted sampling for core documents
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

# CMMC Level keywords
CMMC_LEVEL_KEYWORDS = {
    "1": ["basic cyber hygiene", "foundational", "level 1"],
    "2": ["sp 800-171", "cui", "controlled unclassified information", "110 practices", "level 2"],
    "3": ["sp 800-172", "enhanced security", "134 practices", "advanced persistent threat", "level 3"],
}

# CMMC Domains (17 total)
CMMC_DOMAINS = {
    "Access Control": ["AC", "access control", "authorization", "least privilege", "3.1."],
    "Awareness and Training": ["AT", "awareness", "training", "education", "3.2."],
    "Audit and Accountability": ["AU", "audit", "logging", "accountability", "3.3."],
    "Configuration Management": ["CM", "configuration", "baseline", "change control", "3.4."],
    "Identification and Authentication": ["IA", "authentication", "identity", "credential", "3.5."],
    "Incident Response": ["IR", "incident response", "forensics", "malware", "3.6."],
    "Maintenance": ["MA", "maintenance", "patching", "updates", "3.7."],
    "Media Protection": ["MP", "media protection", "sanitization", "disposal", "3.8."],
    "Personnel Security": ["PS", "personnel", "background check", "insider threat", "3.9."],
    "Physical Protection": ["PE", "physical", "facility", "visitor", "3.10."],
    "Risk Assessment": ["RA", "risk assessment", "vulnerability", "threat", "3.11."],
    "Security Assessment": ["CA", "security assessment", "testing", "evaluation", "3.12."],
    "System and Communications Protection": ["SC", "communications", "encryption", "cryptography", "3.13."],
    "System and Information Integrity": ["SI", "integrity", "flaw remediation", "malicious code", "3.14."],
    "Planning": ["PL", "security plan", "planning", "rules of behavior", "3.15."],
    "System and Services Acquisition": ["SA", "acquisition", "sdlc", "development", "3.16."],
    "Supply Chain Risk Management": ["SR", "supply chain", "c-scrm", "supplier", "3.17."],
}

# Control ID patterns (NIST SP 800-171 format)
CONTROL_PATTERN = re.compile(r'\b3\.(\d{1,2})\.(\d{1,2})\b')


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
                    overlap_text = current_chunk[-self.overlap:] if len(current_chunk) > self.overlap else current_chunk
                    current_chunk = overlap_text + "\n" + sentence
                else:
                    current_chunk = sentence
            else:
                current_chunk += " " + sentence

        if current_chunk.strip():
            chunks.append(current_chunk.strip())

        return chunks


class CMMCMetadataExtractor:
    """Extract CMMC-specific metadata from documents."""

    @staticmethod
    def detect_cmmc_level(text: str, doc_title: str) -> str:
        """Detect CMMC level from document content."""
        combined = (doc_title + " " + text[:5000]).lower()

        # Check for Level 3 indicators (most specific)
        for keyword in CMMC_LEVEL_KEYWORDS["3"]:
            if keyword in combined:
                return "3"

        # Check for Level 2 indicators
        for keyword in CMMC_LEVEL_KEYWORDS["2"]:
            if keyword in combined:
                return "2"

        # Check for Level 1 indicators
        for keyword in CMMC_LEVEL_KEYWORDS["1"]:
            if keyword in combined:
                return "1"

        # Default to "all" if unclear
        return "all"

    @staticmethod
    def detect_domains(text: str) -> Set[str]:
        """Detect relevant CMMC domains from content."""
        text_lower = text.lower()
        domains = set()

        for domain_name, keywords in CMMC_DOMAINS.items():
            for keyword in keywords:
                if keyword.lower() in text_lower:
                    domains.add(domain_name)
                    break

        return domains

    @staticmethod
    def extract_control_ids(text: str) -> List[str]:
        """Extract NIST SP 800-171 control IDs (e.g., 3.1.1, 3.5.3)."""
        matches = CONTROL_PATTERN.findall(text)
        return [f"3.{family}.{control}" for family, control in matches]

    @staticmethod
    def map_control_to_cmmc(control_id: str) -> str:
        """Map NIST control ID to CMMC practice ID."""
        # Extract family number (e.g., "3.1.1" -> "1" -> "AC")
        parts = control_id.split('.')
        if len(parts) != 3 or parts[0] != '3':
            return ""

        family_map = {
            "1": "AC", "2": "AT", "3": "AU", "4": "CM", "5": "IA",
            "6": "IR", "7": "MA", "8": "MP", "9": "PS", "10": "PE",
            "11": "RA", "12": "CA", "13": "SC", "14": "SI", "15": "PL",
            "16": "SA", "17": "SR"
        }

        family_abbrev = family_map.get(parts[1], "")
        if not family_abbrev:
            return ""

        # CMMC practice ID format: AC.L2-3.1.1
        return f"{family_abbrev}.L2-{control_id}"


class CMMCTrainingDataGenerator:
    """Generate CMMC-specific training data."""

    def __init__(
        self,
        system_prompt: str = None,
        max_chunk_size: int = 2000,
        variant: str = "balanced"
    ):
        self.system_prompt = system_prompt or (
            "You are a CMMC-focused cybersecurity assistant trained on public CMMC, "
            "NIST SP 800-171, NIST SP 800-172, and defense-contractor cybersecurity "
            "materials. Help people find relevant requirements, implementation themes, "
            "and draft explanations. Tell users to verify exact practice text and "
            "assessment requirements against the source publication."
        )
        self.chunker = SmartChunker(max_chunk_size)
        self.metadata_extractor = CMMCMetadataExtractor()
        self.variant = variant

    def extract_qa_pairs(self, doc: Dict) -> List[Dict]:
        """Extract Q&A pairs from a document with CMMC metadata."""
        qa_pairs = []
        doc_title = doc.get("title", "Unknown Document")

        # Get content from markdown field (Docling format)
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        if not doc_content:
            logger.warning(f"No content found for {doc_title}")
            return []

        # Extract CMMC metadata
        cmmc_level = self.metadata_extractor.detect_cmmc_level(doc_content, doc_title)
        domains = self.metadata_extractor.detect_domains(doc_content)
        control_ids = self.metadata_extractor.extract_control_ids(doc_content)

        # Strategy 1: Section-based Q&A
        qa_pairs.extend(self._extract_section_qa(doc, cmmc_level, domains))

        # Strategy 2: Control-based Q&A (for SP 800-171/172)
        if control_ids:
            qa_pairs.extend(self._extract_control_qa(doc, control_ids, cmmc_level))

        # Strategy 3: CMMC-specific Q&A
        qa_pairs.extend(self._extract_cmmc_specific_qa(doc, cmmc_level, domains))

        # Strategy 4: Domain-specific Q&A
        for domain in domains:
            qa_pairs.extend(self._extract_domain_qa(doc, domain, cmmc_level))

        # Strategy 5: Semantic chunking (general content)
        qa_pairs.extend(self._extract_semantic_chunks(doc, cmmc_level, domains))

        return qa_pairs

    def _extract_section_qa(
        self,
        doc: Dict,
        cmmc_level: str,
        domains: Set[str]
    ) -> List[Dict]:
        """Extract Q&A from document sections."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        sections = doc.get("sections", [])

        for section in sections:
            heading = section.get("heading", "")
            content = section.get("content", "")

            if not heading or len(content) < 100:
                continue

            # Chunk long sections
            chunks = self.chunker.chunk_text(content, heading)

            for idx, chunk in enumerate(chunks):
                question = f"What does {doc_title} say about {heading}?"
                if len(chunks) > 1:
                    question += f" (Part {idx + 1})"

                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{chunk}",
                    "metadata": {
                        "source": doc_title,
                        "cmmc_level": cmmc_level,
                        "cmmc_domains": list(domains),
                        "type": "section",
                        "chunk_id": idx
                    }
                })

        return qa_pairs

    def _extract_control_qa(
        self,
        doc: Dict,
        control_ids: List[str],
        cmmc_level: str
    ) -> List[Dict]:
        """Extract Q&A for specific controls."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        # Get unique controls
        unique_controls = list(set(control_ids))[:20]  # Limit to prevent explosion

        for control_id in unique_controls:
            # Find context around control mention
            pattern = re.compile(f'({re.escape(control_id)}[^.]*\\.{{1,3}})', re.IGNORECASE)
            matches = pattern.findall(doc_content)

            if matches:
                context = " ".join(matches[:3])  # Use first 3 occurrences
                cmmc_practice = self.metadata_extractor.map_control_to_cmmc(control_id)

                question = f"What is NIST SP 800-171 control {control_id}?"
                if cmmc_practice:
                    question = f"What is CMMC practice {cmmc_practice} (NIST {control_id})?"

                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{context}",
                    "metadata": {
                        "source": doc_title,
                        "cmmc_level": cmmc_level,
                        "nist_control": control_id,
                        "cmmc_practice_id": cmmc_practice,
                        "type": "control"
                    }
                })

        return qa_pairs

    def _extract_cmmc_specific_qa(
        self,
        doc: Dict,
        cmmc_level: str,
        domains: Set[str]
    ) -> List[Dict]:
        """Generate CMMC-specific questions."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        # Only for relevant CMMC documents
        if cmmc_level == "all":
            return []

        chunks = self.chunker.chunk_text(doc_content[:5000])  # First 5000 chars

        for idx, chunk in enumerate(chunks[:2]):  # Limit to 2 chunks
            questions = [
                f"What are the CMMC Level {cmmc_level} requirements?",
                f"How does {doc_title} support CMMC certification?",
                f"What guidance does NIST provide for CMMC Level {cmmc_level}?",
            ]

            for question in questions:
                qa_pairs.append({
                    "question": question,
                    "answer": f"According to {doc_title}:\n\n{chunk}",
                    "metadata": {
                        "source": doc_title,
                        "cmmc_level": cmmc_level,
                        "cmmc_domains": list(domains),
                        "type": "cmmc_requirement"
                    }
                })

        return qa_pairs

    def _extract_domain_qa(
        self,
        doc: Dict,
        domain: str,
        cmmc_level: str
    ) -> List[Dict]:
        """Generate domain-specific questions."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        # Find domain-relevant content
        domain_keywords = CMMC_DOMAINS.get(domain, [])[1:]  # Skip abbreviation
        relevant_text = []

        for paragraph in doc_content.split('\n\n'):
            if any(kw.lower() in paragraph.lower() for kw in domain_keywords):
                relevant_text.append(paragraph)
                if len(' '.join(relevant_text)) > 2000:
                    break

        if not relevant_text:
            return []

        combined_text = '\n\n'.join(relevant_text[:3])
        chunks = self.chunker.chunk_text(combined_text)

        for idx, chunk in enumerate(chunks[:2]):
            question = f"What does CMMC require for {domain}?"
            if cmmc_level != "all":
                question = f"What does CMMC Level {cmmc_level} require for {domain}?"

            qa_pairs.append({
                "question": question,
                "answer": f"According to {doc_title}:\n\n{chunk}",
                "metadata": {
                    "source": doc_title,
                    "cmmc_level": cmmc_level,
                    "cmmc_domain": domain,
                    "type": "domain_guidance"
                }
            })

        return qa_pairs

    def _extract_semantic_chunks(
        self,
        doc: Dict,
        cmmc_level: str,
        domains: Set[str]
    ) -> List[Dict]:
        """Extract general semantic chunks."""
        qa_pairs = []
        doc_title = doc.get("title", "")
        doc_content = doc.get("markdown", "") or doc.get("content", "")

        # Chunk the content
        chunks = self.chunker.chunk_text(doc_content)

        # Limit chunks based on variant
        max_chunks = {
            "core": 20,       # More examples from core docs
            "balanced": 10,
            "comprehensive": 5
        }.get(self.variant, 10)

        for idx, chunk in enumerate(chunks[:max_chunks]):
            if len(chunk) < 200:  # Skip tiny chunks
                continue

            question = f"What guidance does {doc_title} provide?"
            if idx > 0:
                question = f"What additional guidance does {doc_title} provide? (Part {idx + 1})"

            qa_pairs.append({
                "question": question,
                "answer": chunk,
                "metadata": {
                    "source": doc_title,
                    "cmmc_level": cmmc_level,
                    "cmmc_domains": list(domains),
                    "type": "semantic_chunk",
                    "chunk_id": idx
                }
            })

        return qa_pairs

    def format_for_training(self, qa_pair: Dict) -> Dict:
        """Format Q&A pair for training."""
        return {
            "messages": [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": qa_pair["question"]},
                {"role": "assistant", "content": qa_pair["answer"]}
            ],
            "metadata": qa_pair.get("metadata", {})
        }


def process_documents(
    input_dir: Path,
    output_dir: Path,
    variant: str = "balanced",
    weight_core: int = 1
) -> Tuple[List[Dict], Dict]:
    """Process all documents and generate training data."""
    generator = CMMCTrainingDataGenerator(variant=variant)
    all_examples = []

    json_files = list(input_dir.glob("*.json"))
    logger.info(f"Processing {len(json_files)} documents for {variant} variant...")

    # Determine if this is a core document
    core_docs = ["800-171", "800-172", "800-53"]

    for json_file in tqdm(json_files, desc="Processing documents"):
        try:
            with open(json_file) as f:
                doc = json.load(f)

            qa_pairs = generator.extract_qa_pairs(doc)

            # Apply weighting for core documents
            doc_title = doc.get("title", "")
            is_core = any(core in doc_title for core in core_docs)
            multiplier = weight_core if is_core else 1

            # Add examples (with repetition for core docs)
            for _ in range(multiplier):
                for qa in qa_pairs:
                    all_examples.append(generator.format_for_training(qa))

        except Exception as e:
            logger.error(f"Error processing {json_file.name}: {e}")

    # Generate statistics
    stats = {
        "total_examples": len(all_examples),
        "documents_processed": len(json_files),
        "variant": variant,
        "weight_multiplier": weight_core,
    }

    # Count by CMMC level
    level_counts = {}
    domain_counts = {}

    for ex in all_examples:
        level = ex["metadata"].get("cmmc_level", "unknown")
        level_counts[level] = level_counts.get(level, 0) + 1

        domains = ex["metadata"].get("cmmc_domains", [])
        if isinstance(domains, list):
            for domain in domains:
                domain_counts[domain] = domain_counts.get(domain, 0) + 1

    stats["cmmc_level_distribution"] = level_counts
    stats["domain_distribution"] = domain_counts

    logger.info(f"Generated {len(all_examples)} total examples")
    logger.info(f"CMMC Level distribution: {level_counts}")

    return all_examples, stats


def save_dataset(
    examples: List[Dict],
    output_dir: Path,
    train_split: float = 0.8
):
    """Save dataset as train/valid splits."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Shuffle
    import random
    random.seed(42)
    random.shuffle(examples)

    # Split
    split_idx = int(len(examples) * train_split)
    train_examples = examples[:split_idx]
    valid_examples = examples[split_idx:]

    # Save
    train_file = output_dir / "train.jsonl"
    valid_file = output_dir / "valid.jsonl"

    with jsonlines.open(train_file, mode='w') as writer:
        for ex in train_examples:
            writer.write(ex)

    with jsonlines.open(valid_file, mode='w') as writer:
        for ex in valid_examples:
            writer.write(ex)

    logger.info(f"✅ Saved {len(train_examples)} training examples to {train_file}")
    logger.info(f"✅ Saved {len(valid_examples)} validation examples to {valid_file}")


def main():
    parser = argparse.ArgumentParser(description="Prepare CMMC training data")
    parser.add_argument("--input", type=Path, required=True, help="Input directory with extracted documents")
    parser.add_argument("--output", type=Path, required=True, help="Output directory for training data")
    parser.add_argument("--variant", choices=["core", "balanced", "comprehensive"], default="balanced")
    parser.add_argument("--weight-core", type=int, default=3, help="Multiplier for core documents")
    parser.add_argument("--train-split", type=float, default=0.8, help="Training split ratio")

    args = parser.parse_args()

    logger.info(f"Starting CMMC data preparation ({args.variant} variant)...")
    logger.info(f"Input: {args.input}")
    logger.info(f"Output: {args.output}")
    logger.info(f"Core document weight: {args.weight_core}x")

    # Process documents
    examples, stats = process_documents(
        args.input,
        args.output,
        variant=args.variant,
        weight_core=args.weight_core
    )

    # Save dataset
    save_dataset(examples, args.output, train_split=args.train_split)

    # Save stats
    stats_file = args.output / "stats.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)

    logger.info(f"✅ Saved statistics to {stats_file}")
    logger.info(f"\n{'='*60}")
    logger.info(f"CMMC Data Preparation Complete!")
    logger.info(f"{'='*60}")
    logger.info(f"Variant: {args.variant}")
    logger.info(f"Total examples: {stats['total_examples']}")
    logger.info(f"Documents processed: {stats['documents_processed']}")
    logger.info(f"Train/Valid split: {args.train_split:.0%} / {1-args.train_split:.0%}")


if __name__ == "__main__":
    main()
