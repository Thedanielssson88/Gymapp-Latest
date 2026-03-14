#!/bin/bash
# Skapa enkla färgade PNG-ikoner som placeholder

# 512x512 - Mörk fyrkantig ikon med text
cat > public/icon-512.png.base64 << 'EOF'
iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAABHNCSVQICAgIfAhkiAAAAAlwSFlz
AAAOxAAADsQBlSsOGwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAASUVO
RK5CYII=
EOF

echo "Base64 placeholders skapade. Konvertera till PNG manuellt eller använd generate-icons.html"
