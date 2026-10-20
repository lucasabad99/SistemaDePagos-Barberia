// Transform común para toJSON: expone `id` y oculta campos internos de Mongo.
export function limpiarJSON(_doc: unknown, ret: Record<string, unknown>) {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  return ret;
}
