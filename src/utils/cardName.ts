/**
 * Produces a compact label for controls where a full card name would crowd the
 * surrounding input. The first word or comma-delimited name is kept intact.
 */
export function getCompactCardName(name: string): string {
  const trimmedName = name.trim();
  const delimiterIndex = trimmedName.search(/[,\s]/);

  return delimiterIndex === -1 ? trimmedName : trimmedName.slice(0, delimiterIndex);
}
