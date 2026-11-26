#!/usr/bin/env python3
"""
Generate vector embeddings for a training dataset using the OpenAI API.

Creates embeddings using text-embedding-3-small (1536-dim) and saves to:
- Parquet format for efficient storage
- FAISS index for similarity search
"""

import json
import os
from pathlib import Path
from tqdm import tqdm
import pandas as pd
import numpy as np
from openai import OpenAI
import time
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class EmbeddingGenerator:
    def __init__(self, api_key: str, input_dir: str, output_dir: str, batch_size: int = 100):
        self.client = OpenAI(api_key=api_key)
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.batch_size = batch_size

        # text-embedding-3-small pricing: $0.02 per 1M tokens
        # Approximate: 1000 chars ≈ 250 tokens
        self.model = "text-embedding-3-small"
        self.embedding_dim = 1536

        # Stats
        self.total_tokens = 0
        self.total_cost = 0.0
        self.embeddings_generated = 0

    def extract_text(self, example: Dict) -> str:
        """Extract text content from an example."""
        texts = []
        for msg in example.get('messages', []):
            content = msg.get('content', '')
            if content:
                texts.append(content)
        return ' '.join(texts)

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        try:
            response = self.client.embeddings.create(
                model=self.model,
                input=text,
                encoding_format="float"
            )

            # Track usage
            self.total_tokens += response.usage.total_tokens
            self.total_cost = (self.total_tokens / 1_000_000) * 0.02

            return response.data[0].embedding

        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            # Return zero vector on error
            return [0.0] * self.embedding_dim

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a batch of texts."""
        try:
            # OpenAI supports up to 2048 inputs per request
            response = self.client.embeddings.create(
                model=self.model,
                input=texts,
                encoding_format="float"
            )

            # Track usage
            self.total_tokens += response.usage.total_tokens
            self.total_cost = (self.total_tokens / 1_000_000) * 0.02

            # Extract embeddings in order
            embeddings = [item.embedding for item in response.data]
            return embeddings

        except Exception as e:
            logger.error(f"Error generating batch embeddings: {e}")
            # Fallback to individual generation
            return [self.generate_embedding(text) for text in texts]

    def process_dataset(self, dataset_file: Path, checkpoint_file: Path = None):
        """Process a dataset file and generate embeddings."""
        logger.info(f"Processing: {dataset_file.name}")

        # Load examples
        examples = []
        with open(dataset_file, 'r') as f:
            for line in f:
                examples.append(json.loads(line))

        logger.info(f"Loaded {len(examples)} examples")

        # Load checkpoint if exists
        start_idx = 0
        if checkpoint_file and checkpoint_file.exists():
            checkpoint = pd.read_parquet(checkpoint_file)
            start_idx = len(checkpoint)
            logger.info(f"Resuming from checkpoint: {start_idx} examples already processed")

        # Prepare data structure
        data = {
            'id': [],
            'text': [],
            'embedding': [],
            'metadata': []
        }

        # Process in batches
        examples_to_process = examples[start_idx:]

        with tqdm(total=len(examples_to_process), desc=f"Generating embeddings") as pbar:
            for i in range(0, len(examples_to_process), self.batch_size):
                batch = examples_to_process[i:i + self.batch_size]

                # Extract texts
                texts = [self.extract_text(ex) for ex in batch]

                # Generate embeddings
                embeddings = self.generate_embeddings_batch(texts)

                # Store results
                for j, (example, text, embedding) in enumerate(zip(batch, texts, embeddings)):
                    example_id = start_idx + i + j
                    data['id'].append(example_id)
                    data['text'].append(text)
                    data['embedding'].append(embedding)
                    data['metadata'].append(json.dumps(example.get('metadata', {})))

                self.embeddings_generated += len(batch)
                pbar.update(len(batch))

                # Log progress every 1000 examples
                if (i + len(batch)) % 1000 == 0:
                    logger.info(f"Progress: {self.embeddings_generated:,} embeddings | "
                              f"Tokens: {self.total_tokens:,} | "
                              f"Cost: ${self.total_cost:.4f}")

                # Save checkpoint every 5000 examples
                if checkpoint_file and (i + len(batch)) % 5000 == 0:
                    temp_df = pd.DataFrame(data)
                    temp_df.to_parquet(checkpoint_file, index=False)
                    logger.info(f"Checkpoint saved: {len(temp_df)} examples")

                # Rate limiting: small delay to avoid hitting limits
                time.sleep(0.1)

        # Create DataFrame
        df = pd.DataFrame(data)

        logger.info(f"Generated {len(df)} embeddings")
        logger.info(f"Total tokens used: {self.total_tokens:,}")
        logger.info(f"Estimated cost: ${self.total_cost:.4f}")

        return df

    def save_embeddings(self, df: pd.DataFrame, output_name: str):
        """Save embeddings to Parquet format."""
        output_file = self.output_dir / f"{output_name}.parquet"
        df.to_parquet(output_file, index=False)
        logger.info(f"Saved embeddings to: {output_file}")

        # Calculate size
        size_mb = output_file.stat().st_size / (1024 * 1024)
        logger.info(f"File size: {size_mb:.1f} MB")

    def create_faiss_index(self, df: pd.DataFrame, output_name: str):
        """Create FAISS index for similarity search."""
        try:
            import faiss

            # Convert embeddings to numpy array
            embeddings = np.array(df['embedding'].tolist()).astype('float32')

            # Create index
            index = faiss.IndexFlatL2(self.embedding_dim)
            index.add(embeddings)

            # Save index
            index_file = self.output_dir / f"{output_name}.faiss"
            faiss.write_index(index, str(index_file))

            logger.info(f"Created FAISS index: {index_file}")
            logger.info(f"Index contains {index.ntotal} vectors")

        except ImportError:
            logger.warning("FAISS not installed. Skipping index creation.")
            logger.info("Install with: pip install faiss-cpu")

    def run(self):
        """Run the complete embedding generation process."""
        logger.info("="*60)
        logger.info("NIST Dataset Embedding Generation")
        logger.info("="*60)
        logger.info(f"Model: {self.model}")
        logger.info(f"Embedding dimension: {self.embedding_dim}")
        logger.info(f"Batch size: {self.batch_size}")
        logger.info(f"Input directory: {self.input_dir}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info("")

        # Process train set
        train_checkpoint = self.output_dir / 'train_checkpoint.parquet'
        train_df = self.process_dataset(
            self.input_dir / 'train.jsonl',
            checkpoint_file=train_checkpoint
        )
        self.save_embeddings(train_df, 'train_embeddings')
        self.create_faiss_index(train_df, 'train_index')

        # Clean up checkpoint
        if train_checkpoint.exists():
            train_checkpoint.unlink()

        logger.info("")

        # Process validation set
        valid_checkpoint = self.output_dir / 'valid_checkpoint.parquet'
        valid_df = self.process_dataset(
            self.input_dir / 'valid.jsonl',
            checkpoint_file=valid_checkpoint
        )
        self.save_embeddings(valid_df, 'valid_embeddings')
        self.create_faiss_index(valid_df, 'valid_index')

        # Clean up checkpoint
        if valid_checkpoint.exists():
            valid_checkpoint.unlink()

        # Final summary
        logger.info("")
        logger.info("="*60)
        logger.info("EMBEDDING GENERATION COMPLETE")
        logger.info("="*60)
        logger.info(f"Total examples processed: {len(train_df) + len(valid_df):,}")
        logger.info(f"Total embeddings generated: {self.embeddings_generated:,}")
        logger.info(f"Total tokens used: {self.total_tokens:,}")
        logger.info(f"Total cost: ${self.total_cost:.4f}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info("="*60)

        # Save summary
        summary = {
            'total_examples': len(train_df) + len(valid_df),
            'train_examples': len(train_df),
            'valid_examples': len(valid_df),
            'embeddings_generated': self.embeddings_generated,
            'total_tokens': self.total_tokens,
            'total_cost': self.total_cost,
            'model': self.model,
            'embedding_dim': self.embedding_dim
        }

        summary_file = self.output_dir / 'embedding_summary.json'
        with open(summary_file, 'w') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"Summary saved to: {summary_file}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description='Generate embeddings for training data')
    parser.add_argument('--api-key', help='OpenAI API key (or set OPENAI_API_KEY)')
    parser.add_argument('--input-dir', default='data/training',
                       help='Input directory with train.jsonl and valid.jsonl')
    parser.add_argument('--output-dir', default='data/embeddings',
                       help='Output directory for embeddings')
    parser.add_argument('--batch-size', type=int, default=100,
                       help='Batch size for API requests (default: 100)')

    args = parser.parse_args()
    api_key = args.api_key or os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise SystemExit("Set OPENAI_API_KEY or pass --api-key before running embeddings generation.")

    generator = EmbeddingGenerator(
        api_key=api_key,
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        batch_size=args.batch_size
    )

    generator.run()


if __name__ == '__main__':
    main()
