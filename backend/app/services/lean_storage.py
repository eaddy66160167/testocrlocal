"""Allowlisted model identity; never an upstream transport archive."""
def compact_provenance(response):
    composition = (response or {}).get('composition')
    if not isinstance(composition, dict):
        return None
    result = {}
    for key in ('detection', 'recognition'):
        model = composition.get(key)
        if isinstance(model, dict):
            result[key] = {k: model[k] for k in ('id', 'name', 'source', 'kind', 'version', 'weight') if k in model}
    for key in ('engine', 'version', 'det_weight', 'rec_weight'):
        if isinstance(composition.get(key), (str, int)):
            result[key] = composition[key]
    return {'composition': result} if result else None
