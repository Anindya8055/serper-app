#!/bin/bash
# Train fastText models for site classification
# Run from repo root: bash backend/scripts/train-fasttext.sh
set -e

FASTTEXT_BIN="${FASTTEXT_BIN:-$HOME/fastText/fasttext}"
FASTTEXT_DIR="backend/fasttext"

if [ ! -f "$FASTTEXT_BIN" ]; then
  echo "fastText binary not found at $FASTTEXT_BIN"
  echo "Installing fastText..."
  cd /tmp
  git clone https://github.com/facebookresearch/fastText.git
  cd fastText
  make -j4
  mkdir -p "$HOME/fastText"
  cp fasttext "$HOME/fastText/fasttext"
  cd -
  echo "fastText installed at $HOME/fastText/fasttext"
fi

echo "Training site model..."
"$FASTTEXT_BIN" supervised \
  -input "$FASTTEXT_DIR/site-train.txt" \
  -output "$FASTTEXT_DIR/site-model" \
  -epoch 100 \
  -lr 0.3 \
  -wordNgrams 3 \
  -dim 150 \
  -loss softmax \
  -minCount 1 \
  -minn 0 \
  -maxn 0

echo "Training content model..."
"$FASTTEXT_BIN" supervised \
  -input "$FASTTEXT_DIR/content-train.txt" \
  -output "$FASTTEXT_DIR/content-model" \
  -epoch 100 \
  -lr 0.3 \
  -wordNgrams 3 \
  -dim 150 \
  -loss softmax \
  -minCount 1 \
  -minn 0 \
  -maxn 0

echo ""
echo "=== Validation: site model ==="
"$FASTTEXT_BIN" test "$FASTTEXT_DIR/site-model.bin" "$FASTTEXT_DIR/site.valid.txt"

echo ""
echo "=== Validation: content model ==="
"$FASTTEXT_BIN" test "$FASTTEXT_DIR/content-model.bin" "$FASTTEXT_DIR/content.valid.txt"

echo ""
echo "Done. Models saved to $FASTTEXT_DIR/site-model.bin and $FASTTEXT_DIR/content-model.bin"
echo "Restart pm2 to load the new models: pm2 restart serper-backend"
