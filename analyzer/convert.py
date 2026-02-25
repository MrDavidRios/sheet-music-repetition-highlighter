"""OMR conversion: PDF/image to MusicXML using homr."""

import os
import shutil

import onnxruntime as ort

from homr.main import ProcessingConfig, process_image
from homr.music_xml_generator import XmlGeneratorArguments

ENABLE_DEBUG = False

WRITE_STAFF_POSITIONS = False
READ_STAFF_POSITIONS = False


def convert(input_path: str, output_path: str | None = None) -> str:
    """Convert image to MusicXML.

    Args:
        input_path: Path to input image (PNG, JPG, etc.)
        output_path: Optional output path; if None, uses input path with .musicxml extension

    Returns:
        Path to generated MusicXML file
    """

    has_gpu_support = "CUDAExecutionProvider" in ort.get_available_providers()

    config = ProcessingConfig(
        ENABLE_DEBUG,
        # Read an existing cache file or create a new one (https://github.com/liebharc/homr/blob/46ab9cf63fd6b7cbafd31478a1df8bf2b413f84a/homr/main.py#L357C6-L357C7)
        False,
        WRITE_STAFF_POSITIONS,
        READ_STAFF_POSITIONS,
        -1,
        has_gpu_support,  # Enable GPU usage if GPU available
    )
    xml_args = XmlGeneratorArguments()

    process_image(input_path, config, xml_args)

    # homr outputs to same dir with .musicxml extension
    base = os.path.splitext(input_path)[0]
    generated_path = base + ".musicxml"

    if output_path and output_path != generated_path:
        shutil.move(generated_path, output_path)
        return output_path

    return generated_path


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m analyzer.convert <image_path> [output_path]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    result = convert(input_file, output_file)
    print(f"Generated: {result}")
