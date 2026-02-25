"""OMR conversion: PDF/image to MusicXML using homr."""

import os
import shutil
import xml.etree.ElementTree as ET

import onnxruntime as ort

from homr.main import ProcessingConfig, process_image
from homr.music_xml_generator import XmlGeneratorArguments

ENABLE_DEBUG = False

WRITE_STAFF_POSITIONS = False
READ_STAFF_POSITIONS = False


def fix_grand_staff(xml_path: str) -> None:
    """Merge consecutive <attributes> blocks and ensure <staves> is present.

    HOMR generates split attributes blocks. OSMD only reads the first,
    missing staves/clefs in subsequent blocks. This merges them and
    ensures <staves> element exists when multiple clefs are present.
    """
    tree = ET.parse(xml_path)
    root = tree.getroot()

    # Find all measures
    for measure in root.iter('measure'):
        children = list(measure)
        i = 0
        while i < len(children) - 1:
            curr = children[i]
            next_elem = children[i + 1]

            # Check for consecutive attributes blocks
            if curr.tag == 'attributes' and next_elem.tag == 'attributes':
                # Merge next_elem's children into curr
                for child in list(next_elem):
                    curr.append(child)
                # Remove the second attributes block
                measure.remove(next_elem)
                children = list(measure)  # Refresh list
                # Don't increment i, check if there's another consecutive attributes
            else:
                i += 1

    # Ensure <staves> exists in first measure if multiple clefs present
    first_measure = root.find('.//measure')
    if first_measure is not None:
        attrs = first_measure.find('attributes')
        if attrs is not None:
            clefs = attrs.findall('clef')
            staves_elem = attrs.find('staves')
            if len(clefs) > 1 and staves_elem is None:
                # Insert <staves> before first <clef>
                staves = ET.Element('staves')
                staves.text = str(len(clefs))
                clef_idx = list(attrs).index(clefs[0])
                attrs.insert(clef_idx, staves)

    tree.write(xml_path, encoding='UTF-8', xml_declaration=True)


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

    # Fix split attributes blocks for OSMD compatibility
    fix_grand_staff(generated_path)

    final_path = output_path or generated_path
    if output_path and generated_path != output_path:
        shutil.move(generated_path, final_path)

    return final_path


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m analyzer.convert <image_path> [output_path]")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    result = convert(input_file, output_file)
    print(f"Generated: {result}")
