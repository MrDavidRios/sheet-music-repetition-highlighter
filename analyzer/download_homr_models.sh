#!/usr/bin/env bash
set -euo pipefail

PYTHON=".venv/bin/python"

HOMR_PATH=$($PYTHON -c "import homr; print(homr.__file__.rsplit('/', 1)[0])")

SEGNET_MODEL=$($PYTHON -c "
import re, homr.segmentation.config as c
print(re.search(r'model_name = \"(.+?)\"', open(c.__file__).read()).group(1))
")

TRANSFORMER_MODEL=$($PYTHON -c "
import re, homr.transformer.configs as c
print(re.search(r'model_name = \"(.+?)\"', open(c.__file__).read()).group(1))
")

echo "homr path:         $HOMR_PATH"
echo "Segnet model:      $SEGNET_MODEL"
echo "Transformer model: $TRANSFORMER_MODEL"

# Download and install segnet model
gh release download onnx_checkpoints -R liebharc/homr \
  -p "${SEGNET_MODEL}.zip" -D /tmp --skip-existing
unzip -o "/tmp/${SEGNET_MODEL}.zip" -d "$HOMR_PATH/segmentation/"

# Download and install encoder + decoder models
gh release download onnx_checkpoints -R liebharc/homr \
  -p "encoder_${TRANSFORMER_MODEL}.zip" \
  -p "decoder_${TRANSFORMER_MODEL}.zip" -D /tmp --skip-existing
unzip -o "/tmp/encoder_${TRANSFORMER_MODEL}.zip" -d "$HOMR_PATH/transformer/"
unzip -o "/tmp/decoder_${TRANSFORMER_MODEL}.zip" -d "$HOMR_PATH/transformer/"

echo "Done."