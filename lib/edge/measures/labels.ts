/** Input labels that carry a name, like "Unit 501: glazing share of floor area". A stored run keeps only labels, so the panel reads the name back with `nameOf`. */
export type LabelFamily = {
  of: (name: string) => string
  nameOf: (label: string) => string | null
}

export const labelFamily = (prefix: string, suffix = ''): LabelFamily => ({
  of: (name) => `${prefix}${name}${suffix}`,
  nameOf: (label) =>
    label.length > prefix.length + suffix.length && label.startsWith(prefix) && label.endsWith(suffix)
      ? label.slice(prefix.length, label.length - suffix.length)
      : null,
})
