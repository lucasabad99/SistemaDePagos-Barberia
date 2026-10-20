import { Schema, model } from 'mongoose';

// Numeradores correlativos (ej: número de papelito). El $inc es atómico, así que
// dos barberos anotando a la vez nunca reciben el mismo número.
const contadorSchema = new Schema({ _id: String, valor: { type: Number, default: 0 } });
const Contador = model('Contador', contadorSchema);

export async function siguienteNumero(nombre: string, inicio = 1000) {
  const c = await Contador.findOneAndUpdate({ _id: nombre }, { $inc: { valor: 1 } }, { upsert: true, returnDocument: 'after' });
  return inicio + c!.valor;
}
