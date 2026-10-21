const BEDROOM = /habitaci[oó]n|alcoba|dormitorio|\bcuarto\b|\bAl\.|bedroom/i
const WET = /ba[ñn]o|ducha|cocina|lavander|lavadero|bathroom|washroom|toilet|kitchen|laundry|shower|\bwc\b/i
const OUTDOOR = /balc[oó]n|terraza|patio|jard[ií]n|exterior|deck|terrace|porch|courtyard/i
/** Spaces nobody occupies: circulation cores, parking, storage, plant and refuse rooms. */
const UNOCCUPIED =
  /shaft|ducto|elevator|ascensor|escalera|stair|emergency exit|parqueadero|parking|garaje|garage|estacionamiento|dep[oó]sito|bodega|storage|cuarto (de )?(basuras?|m[aá]quinas)|cuarto (t[eé]cnico|[uú]til)|basuras|residuos|mechanical|el[eé]ctric|subestaci/i

export const isOutdoorRoomName = (name: string): boolean => OUTDOOR.test(name)
export const isWetRoomName = (name: string): boolean => WET.test(name)
export const isBedroomName = (name: string): boolean => BEDROOM.test(name) && !UNOCCUPIED.test(name)
/** An indoor space people occupy, the "piso ocupado (habitable)" of CCRp3. */
export const isHabitableName = (name: string): boolean => !OUTDOOR.test(name) && !UNOCCUPIED.test(name)
