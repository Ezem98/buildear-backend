import { IMaterial } from './material.js'
import { IStep } from './step.js'

export interface IGuide {
    titulo: string
    explicacion: string
    pasos: IStep[]
    materiales: IMaterial[]
    tiempo_insumido: number
    costo: number
}
