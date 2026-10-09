"""A small JSON Schema checker covering the keywords the bundle schema uses.

Supported: type, const, enum, required, properties, additionalProperties,
items, minItems, maxItems, minLength, pattern, minimum, and local $ref.
Anything else in a schema raises, so the schema file cannot silently outgrow
this checker.
"""
import re

_KNOWN = {
    "$schema", "$id", "$defs", "$ref", "title", "description", "type", "const",
    "enum", "required", "properties", "additionalProperties", "items",
    "minItems", "maxItems", "minLength", "pattern", "minimum",
}


def _is_type(value, name):
    if name == "object":
        return isinstance(value, dict)
    if name == "array":
        return isinstance(value, list)
    if name == "string":
        return isinstance(value, str)
    if name == "boolean":
        return isinstance(value, bool)
    if name == "null":
        return value is None
    if name == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    raise ValueError(f"unsupported type {name!r}")


def _resolve(root, ref):
    if not ref.startswith("#/"):
        raise ValueError(f"only local $ref is supported: {ref}")
    node = root
    for part in ref[2:].split("/"):
        node = node[part]
    return node


def check(value, schema, root=None, path="$"):
    """Return a list of (path, message) violations."""
    root = schema if root is None else root
    unknown = set(schema) - _KNOWN
    if unknown:
        raise ValueError(f"schema keyword(s) not supported at {path}: {sorted(unknown)}")
    if "$ref" in schema:
        return check(value, _resolve(root, schema["$ref"]), root, path)
    out = []
    if "const" in schema and value != schema["const"]:
        out.append((path, f"must equal {schema['const']!r}"))
    if "enum" in schema and value not in schema["enum"]:
        out.append((path, f"must be one of {schema['enum']}"))
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_is_type(value, t) for t in types):
            out.append((path, f"must be of type {' or '.join(types)}"))
            return out
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            out.append((path, "must not be empty"))
        if "pattern" in schema and not re.search(schema["pattern"], value):
            out.append((path, f"must match {schema['pattern']}"))
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            out.append((path, f"must be >= {schema['minimum']}"))
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            out.append((path, f"needs at least {schema['minItems']} item(s)"))
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            out.append((path, f"allows at most {schema['maxItems']} item(s)"))
        if "items" in schema:
            for i, item in enumerate(value):
                out.extend(check(item, schema["items"], root, f"{path}[{i}]"))
    if isinstance(value, dict):
        props = schema.get("properties", {})
        for key in schema.get("required", []):
            if key not in value:
                out.append((path, f"missing required property {key!r}"))
        extra = schema.get("additionalProperties", True)
        for key, item in value.items():
            if key in props:
                out.extend(check(item, props[key], root, f"{path}.{key}"))
            elif extra is False:
                out.append((path, f"unexpected property {key!r}"))
            elif isinstance(extra, dict):
                out.extend(check(item, extra, root, f"{path}.{key}"))
    return out
