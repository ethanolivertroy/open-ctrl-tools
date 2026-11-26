#!/usr/bin/env python3
"""
Interactive chat interface for the HackIDLE NIST Coder model using MLX.
"""

import os
from mlx_lm import load, generate

def main():
    print("Loading HackIDLE-NIST-Coder model...")
    print("(This may take a minute the first time)\n")

    model_path = os.getenv("MODEL_PATH", "models/hackidle-nist-coder-merged")
    model, tokenizer = load(model_path)

    print("✓ Model loaded successfully!")
    print("\nHackIDLE-NIST-Coder - NIST-focused local assistant")
    print("=" * 60)
    print("Ask about NIST cybersecurity standards, then verify exact details against the source docs.")
    print("Type 'exit' or 'quit' to end the conversation.\n")

    system_prompt = """You are HackIDLE-NIST-Coder, a NIST-focused local assistant built from Qwen2.5-Coder and a public NIST cybersecurity corpus. Use the corpus to help with cybersecurity planning, NIST document discovery, control-family exploration, compliance drafting, and implementation tradeoff discussions.

Useful areas include:
- NIST Cybersecurity Framework (CSF)
- Risk Management Framework (RMF)
- SP 800 series security controls
- FIPS cryptographic standards
- Cloud security guidelines
- Zero Trust Architecture
- Supply chain risk management
- Privacy and data protection

When answering questions:
1. Cite specific NIST documents and control identifiers when applicable
2. Provide practical, actionable guidance
3. Explain technical concepts clearly
4. Reference relevant frameworks and standards
5. Say when the answer should be verified against the source publication
6. Do not present exact control names, RMF step order, or SP 800-207 component lists as final unless you are sure"""

    conversation_history = []

    while True:
        try:
            user_input = input("\n\033[94mYou:\033[0m ")

            if user_input.lower() in ['exit', 'quit', 'q']:
                print("\nGoodbye!")
                break

            if not user_input.strip():
                continue

            # Build prompt in Qwen2.5 chat format
            messages = [
                {"role": "system", "content": system_prompt},
            ]

            # Add conversation history
            for msg in conversation_history:
                messages.append(msg)

            # Add current user message
            messages.append({"role": "user", "content": user_input})

            # Format prompt using tokenizer's chat template
            prompt = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True
            )

            print("\n\033[92mAssistant:\033[0m ", end="", flush=True)

            # Generate response
            response = generate(
                model,
                tokenizer,
                prompt=prompt,
                max_tokens=1024,
                temp=0.7,
                top_p=0.9,
                verbose=False
            )

            print(response)

            # Add to conversation history
            conversation_history.append({"role": "user", "content": user_input})
            conversation_history.append({"role": "assistant", "content": response})

            # Keep conversation history manageable (last 10 exchanges)
            if len(conversation_history) > 20:
                conversation_history = conversation_history[-20:]

        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"\n\033[91mError:\033[0m {e}")
            continue

if __name__ == "__main__":
    main()
