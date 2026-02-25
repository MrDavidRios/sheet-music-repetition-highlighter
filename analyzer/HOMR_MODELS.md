# homr Model Setup

homr doesn't bundle ONNX models in pip package. Download manually from GitHub releases.

## Find model versions

Check hardcoded model names in installed package:

```bash
grep -r "model_name = " $(python -c "import homr; print(homr.__file__.rsplit('/', 1)[0])")
```

## Download models

```bash
HOMR_PATH=$(python -c "import homr; print(homr.__file__.rsplit('/', 1)[0])")

# Segnet model (segmentation)
gh release download onnx_checkpoints -R liebharc/homr \
  -p "segnet_<VERSION>.zip" -D /tmp
unzip /tmp/segnet_<VERSION>.zip -d "$HOMR_PATH/segmentation/"

# Encoder + decoder models (transformer)
gh release download onnx_checkpoints -R liebharc/homr \
  -p "encoder_<VERSION>.zip" \
  -p "decoder_<VERSION>.zip" -D /tmp
unzip /tmp/encoder_<VERSION>.zip -d "$HOMR_PATH/transformer/"
unzip /tmp/decoder_<VERSION>.zip -d "$HOMR_PATH/transformer/"
```

## List available models

```bash
gh release view onnx_checkpoints -R liebharc/homr --json assets --jq '.assets[].name'
```
