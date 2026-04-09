import sys
from PIL import Image
import os

def generate_icons(source_path):
    sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'icons')
    os.makedirs(output_dir, exist_ok=True)
    img = Image.open(source_path).convert('RGBA')
    for size in sizes:
        resized = img.resize((size, size), Image.LANCZOS)
        output_path = os.path.join(output_dir, f'icon-{size}x{size}.png')
        resized.save(output_path, 'PNG')
        print(f'Generated {output_path}')
    apple = img.resize((180, 180), Image.LANCZOS)
    apple_path = os.path.join(output_dir, 'apple-touch-icon.png')
    apple.save(apple_path, 'PNG')
    print(f'Generated {apple_path}')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python generate-icons.py <source-image-path>")
        sys.exit(1)
    generate_icons(sys.argv[1])
