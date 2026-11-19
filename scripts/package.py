import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def openssl(*arguments, data=None):
    return subprocess.run(
        ["openssl", *arguments], input=data, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, check=True,
    ).stdout


def varint(value):
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return bytes(result)


def field(number, value):
    return varint((number << 3) | 2) + varint(len(value)) + value


def generate_key(key):
    if key.exists():
        raise ValueError(f"Refusing to replace existing key: {key}")
    if not key.parent.is_dir():
        raise ValueError(f"Key parent directory does not exist: {key.parent}")
    private_key = openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048")
    descriptor = os.open(key, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        output.write(private_key)
    print(f"Created private signing key: {key}. Back it up securely; never commit it.")


def archive(directory):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as package:
        for source in sorted(directory.rglob("*")):
            relative = source.relative_to(directory)
            if source.is_symlink():
                raise ValueError(f"Symlink in package: {relative}")
            if "_metadata" in relative.parts:
                continue
            if source.is_file():
                if source.suffix.lower() in {".pem", ".crx"} or relative.as_posix() == "input.css":
                    raise ValueError(f"Private/generated input in package: {relative}")
                entry = zipfile.ZipInfo(relative.as_posix(), (1980, 1, 1, 0, 0, 0))
                entry.create_system = 3
                entry.external_attr = 0o100644 << 16
                package.writestr(entry, source.read_bytes())
    return output.getvalue()


def pack(directory, key, output):
    if not key.is_file():
        raise ValueError(f"Signing key missing: {key}. Run npm run src-keygen once, or supply --key.")
    if not output.parent.is_dir():
        raise ValueError(f"Output parent directory does not exist: {output.parent}")
    if output == key or output == directory or directory in output.parents:
        raise ValueError("Package output must be outside the extension directory and separate from the key")
    manifest = json.loads((directory / "manifest.json").read_text())
    package_info = json.loads((ROOT / "package.json").read_text())
    if manifest["version"] != package_info["version"] or manifest.get("update_url"):
        raise ValueError("Build first: package version must match and update_url must be absent")
    openssl("rsa", "-in", str(key), "-check", "-noout")
    os.chmod(key, 0o600)
    public_key = openssl("pkey", "-in", str(key), "-pubout", "-outform", "DER")
    identity = hashlib.sha256(public_key).digest()[:16]
    signed_header = field(1, identity)
    payload = archive(directory)
    signed_data = b"CRX3 SignedData\x00" + struct.pack("<I", len(signed_header)) + signed_header + payload
    signature = openssl("dgst", "-sha256", "-sign", str(key), data=signed_data)
    proof = field(1, public_key) + field(2, signature)
    header = field(2, proof) + field(10000, signed_header)
    output.write_bytes(b"Cr24" + struct.pack("<II", 3, len(header)) + header + payload)
    extension_id = "".join(chr(ord("a") + int(digit, 16)) for digit in identity.hex())
    print(f"Packaged CRX3: {output}\nExtension ID: {extension_id}\nVersion: {manifest['version']}")


def main():
    parser = argparse.ArgumentParser(description="Generate a private RSA key or package a deterministic signed CRX3")
    parser.add_argument("command", choices=["keygen", "pack"])
    parser.add_argument("--key", type=Path, default=ROOT / "extension.pem")
    parser.add_argument("--dist", type=Path, default=ROOT / "extension")
    parser.add_argument("--output", type=Path, default=ROOT / "extension.crx")
    arguments = parser.parse_args()
    try:
        if arguments.command == "keygen":
            generate_key(arguments.key.resolve())
        else:
            pack(arguments.dist.resolve(), arguments.key.resolve(), arguments.output.resolve())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
