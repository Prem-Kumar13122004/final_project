#!/usr/bin/env python3
"""
Simple launcher for the blur tool
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from blur_tool import main

if __name__ == "__main__":
    main()