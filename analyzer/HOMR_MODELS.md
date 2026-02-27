# homr Model Setup

homr doesn't bundle ONNX models in pip package. Download manually from GitHub releases.

This process has also been automated in the ./download_homr_models.sh script. You can run that instead.

## Find model versions

Check hardcoded model names in installed package:

```bash
# Segnet model name (segmentation)
grep "model_name = " $(python -c "import homr.segmentation.config as c; print(c.__file__)")

# Encoder/decoder model name (transformer)
grep "model_name = " $(python -c "import homr.transformer.configs as c; print(c.__file__)")
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
