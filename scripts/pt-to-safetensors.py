"""Converts a PyTorch .pt/.pth model of plain tensors to .safetensors, without ever running code from the file.

  python pt_to_safetensors.py <input.pt> [output.safetensors]

torch.load(weights_only=True) only rebuilds tensors, numbers, strings, lists and dicts; a file that tries to
run anything else is refused. Every tensor is read back from the new file and compared before the script finishes.
"""
import os, sys, torch
from safetensors.torch import save_file, load_file

src = sys.argv[1]
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(src)[0] + ".safetensors"
if os.path.exists(dst):
    sys.exit(f"{dst} already exists; not overwriting it")

obj = torch.load(src, map_location="cpu", weights_only=True)
inner = obj
for k in ("params_ema", "params", "state_dict", "model"):   # common wrappers around the weights
    if isinstance(obj, dict) and k in obj and isinstance(obj[k], dict):
        inner = obj[k]
        break
tensors = {k: v.contiguous() for k, v in inner.items() if hasattr(v, "shape")}
if not tensors:
    sys.exit("no tensors found")
save_file(tensors, dst, metadata={"format": "pt", "converted_from": os.path.basename(src)})

back = load_file(dst)
assert back.keys() == tensors.keys(), "tensor names differ"
for k, v in tensors.items():
    assert torch.equal(back[k], v), f"tensor {k} differs"
print(f"wrote {dst} ({os.path.getsize(dst)/1e6:.1f} MB); {len(tensors)} tensors read back identical")
