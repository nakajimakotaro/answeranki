
export function toStringAnkiQuery(query: string)
{
  return query.replace(/:/g, '\\:').replace(/"/g, '\\"');
}
