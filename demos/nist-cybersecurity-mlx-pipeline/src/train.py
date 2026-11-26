#!/usr/bin/env python3
"""
MLX Fine-Tuning Script

Fine-tune LLM using MLX framework optimized for Apple Silicon.
"""

import argparse
import logging
from pathlib import Path
import shlex
import subprocess
import sys
import yaml

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MLXTrainer:
    """Fine-tune models using MLX framework."""

    def __init__(self, config_path: str):
        """
        Initialize trainer.

        Args:
            config_path: Path to training configuration YAML
        """
        self.config = self.load_config(config_path)

    def load_config(self, config_path: str) -> dict:
        """Load training configuration."""
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        return config

    def train(self, run: bool = False):
        """
        Prepare or execute the MLX fine-tuning command.
        """
        command = self._build_command()
        pretty_command = " ".join(shlex.quote(part) for part in command)
        data_path = self._resolve_data_path()

        logger.info("Base model: %s", self.config['model']['name'])
        logger.info("Training data: %s", data_path)
        logger.info("Adapter output: %s", self.config['output']['adapter_path'])
        logger.info("MLX command:\n%s", pretty_command)

        if not run:
            logger.info("Dry run only. Re-run with --run to start training.")
            return

        adapter_parent = Path(self.config['output']['adapter_path']).parent
        adapter_parent.mkdir(parents=True, exist_ok=True)

        subprocess.run(command, check=True)

    def _resolve_data_path(self) -> str:
        """
        Resolve the MLX training data path.

        MLX expects a directory containing `train.jsonl` and `valid.jsonl`.
        The repo config keeps explicit file paths, so prefer their shared parent
        when both files live together.
        """
        data_config = self.config['data']
        train_path = Path(data_config['train_path'])
        valid_path = Path(data_config.get('valid_path', ''))

        if train_path.is_dir():
            return str(train_path)

        if valid_path and train_path.parent == valid_path.parent:
            return str(train_path.parent)

        return str(train_path)

    def _prepare_mlx_args(self) -> dict:
        """Prepare arguments for MLX fine-tuning."""
        config = self.config
        training = config['training']

        return {
            'model': config['model']['name'],
            'data': self._resolve_data_path(),
            'adapter_path': config['output']['adapter_path'],
            'iters': training['num_iterations'],
            'batch_size': training['batch_size'],
            'num_layers': training['lora_layers'],
            'learning_rate': training['learning_rate'],
            'save_every': training.get('save_every', 100),
            'val_batches': training.get('val_batches', 25),
            'steps_per_eval': training.get('val_interval', 100),
            'steps_per_report': training.get('steps_per_report', 10),
            'max_seq_length': training.get('max_seq_length', 2048),
            'optimizer': training.get('optimizer', 'adamw'),
            'grad_checkpoint': training.get('grad_checkpoint', False),
            'seed': training.get('seed', 42),
        }

    def _build_command(self) -> list[str]:
        """Build a shell-safe command for MLX LoRA training."""
        args = self._prepare_mlx_args()

        command = [
            sys.executable,
            "-m",
            "mlx_lm",
            "lora",
            "--model",
            args['model'],
            "--train",
            "--data",
            args['data'],
            "--iters",
            str(args['iters']),
            "--batch-size",
            str(args['batch_size']),
            "--num-layers",
            str(args['num_layers']),
            "--learning-rate",
            str(args['learning_rate']),
            "--adapter-path",
            args['adapter_path'],
            "--optimizer",
            str(args['optimizer']),
            "--val-batches",
            str(args['val_batches']),
            "--steps-per-eval",
            str(args['steps_per_eval']),
            "--steps-per-report",
            str(args['steps_per_report']),
            "--save-every",
            str(args['save_every']),
            "--max-seq-length",
            str(args['max_seq_length']),
            "--seed",
            str(args['seed']),
        ]

        if args['grad_checkpoint']:
            command.append("--grad-checkpoint")

        return command


def main():
    parser = argparse.ArgumentParser(description='Fine-tune LLM with MLX')
    parser.add_argument('--config', '-c', default='config/training_config.yaml',
                        help='Path to training configuration')
    parser.add_argument('--run', action='store_true',
                        help='Execute training instead of printing the MLX command')

    args = parser.parse_args()

    config_path = Path(args.config)
    if not config_path.exists():
        logger.error(f"Configuration file not found: {config_path}")
        return

    trainer = MLXTrainer(str(config_path))
    trainer.train(run=args.run)


if __name__ == '__main__':
    main()
